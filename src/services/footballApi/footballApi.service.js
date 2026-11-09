const axios = require('axios');
const cron = require('node-cron');
const { Match } = require('../../models');
const { generateMatchOdds } = require('../../utils/matchGenerator.util');
const { toMarketArray } = require('../../utils/marketArray.util');

const API_BASE_URL = 'https://api.5dollarfootballapi.com/v1';
const API_MATCH_SOURCE = 'FOOTBALL_API';
const FIXTURE_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIXTURE_RETRY_INTERVAL_MS = 30 * 60 * 1000;
const FIXTURE_LOOKAHEAD_DAYS = 7;
const LIVE_SYNC_CRON = '* * * * *';
const LIVE_CACHE_TTL_MS = 60 * 1000;
const FIXTURE_STATUS_RECHECK_INTERVAL_MS = 60 * 1000;
const MAX_FIXTURE_STATUS_CHECKS_PER_SYNC = 4;
const FIXTURE_ODDS_CACHE_TTL_MS = 10 * 60 * 1000;

let syncInProgress = false;
let nextFixtureSyncAt = 0;
let lastScheduledSyncHadFixtures = false;
let socketServer = null;
let cachedLiveFixtures = null;
let cachedLiveFixturesAt = 0;
let liveFixturesRequest = null;
let fixtureOddsIncludeAvailable = null;
const fixtureOddsCache = new Map();
const fixtureOddsRequests = new Map();
const fixtureStatusCheckTimes = new Map();

const formatKickoff = (fixture) => {
  const rawKickoff = fixture.kickoff_utc || fixture.date;
  const kickoff = rawKickoff
    ? new Date(rawKickoff)
    : fixture.timestamp
      ? new Date(Number(fixture.timestamp) * 1000)
      : null;

  if (!kickoff || Number.isNaN(kickoff.getTime())) {
    throw new Error(`Fixture ${fixture.id} has an invalid kickoff timestamp`);
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.FOOTBALL_API_TIME_ZONE || 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(kickoff);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}`
  };
};

const getScore = (fixture) => {
  const fullTime = fixture.score?.fulltime || fixture.score?.fullTime || {};
  const home = fixture.goals?.home ?? fullTime.home ?? fullTime.homeScore;
  const away = fixture.goals?.away ?? fullTime.away ?? fullTime.awayScore;
  const hasResult = home !== null && home !== undefined && away !== null && away !== undefined;

  return {
    hasResult,
    score: {
      home: hasResult ? Number(home) : 0,
      away: hasResult ? Number(away) : 0
    }
  };
};

const mapFixtureStatus = (fixtureStatus, hasResult) => {
  const rawStatus = typeof fixtureStatus === 'string'
    ? fixtureStatus
    : fixtureStatus?.short || fixtureStatus?.long || '';
  const status = rawStatus.toLowerCase();

  if (status === 'scheduled' || ['ns', 'tbd'].includes(status)) return 'UPCOMING';
  if (status === 'in_play' || status === 'live' || ['1h', '2h', 'ht', 'et', 'bt', 'p'].includes(status)) return 'LIVE';
  if (status === 'finished' || ['ft', 'aet', 'pen'].includes(status)) return hasResult ? 'FINISHED' : 'UNKNOWN';
  if (status === 'unknown') return 'UNKNOWN';
  return 'UNKNOWN';
};

const normalizeFixture = (fixture) => {
  const externalId = fixture.id ?? fixture.fixture?.id;
  const homeTeam = fixture.teams?.home?.name || fixture.home_team || fixture.homeTeam;
  const awayTeam = fixture.teams?.away?.name || fixture.away_team || fixture.awayTeam;

  if (externalId === null || externalId === undefined || !homeTeam || !awayTeam) {
    throw new Error('Fixture is missing its id or team names');
  }

  const { date, time } = formatKickoff(fixture);
  const { hasResult, score } = getScore(fixture);
  const status = mapFixtureStatus(fixture.status, hasResult);
  const finalScore = status === 'FINISHED'
    ? { homeScore: score.home, awayScore: score.away }
    : null;
  const bookmakerOdds = fixture.odds?.bookmakers
    ? (fixture.odds.bookmakers.find((bookmaker) => bookmaker.slug === 'bet365')
      || fixture.odds.bookmakers[0])?.odds
    : fixture.odds?.bet365?.odds || fixture.odds?.bet365 || fixture.odds;
  const referenceOdds = normalizeApiMarkets(bookmakerOdds, status);
  const odds = generateMatchOdds(referenceOdds['1X2'], referenceOdds, {
    oddsSeed: String(externalId)
  });

  return {
    match_code: `API-${externalId}`,
    source: API_MATCH_SOURCE,
    external_id: String(externalId),
    home_team: homeTeam,
    away_team: awayTeam,
    league: fixture.league?.name || fixture.league_name || 'Football',
    date,
    time,
    status,
    odds,
    markets: toMarketArray(odds, homeTeam, awayTeam),
    predetermined_script: finalScore ? { final_ft: finalScore } : null,
    current_score: score
  };
};

const getOddsSnapshot = (market, status, priceKeys) => {
  if (!market || typeof market !== 'object') return null;

  const snapshots = status === 'LIVE'
    ? [market.inplay, market.closing, market.opening, market]
    : [market.closing, market.opening, market.inplay, market];

  return snapshots.find((snapshot) =>
    snapshot && typeof snapshot === 'object'
    && priceKeys.some((key) => Number(snapshot[key]) > 0)
  ) || null;
};

const formatLine = (line) => {
  const value = Number(line);
  if (!Number.isFinite(value)) return null;
  return Number.isInteger(value) ? String(value) : String(value);
};

const addOverUnderMarket = (markets, marketKey, source, status, lineFromItem = false) => {
  if (!source || typeof source !== 'object') return;

  const snapshot = getOddsSnapshot(source, status, ['over', 'under']);
  if (!snapshot) return;
  const line = formatLine(lineFromItem ? source.line : snapshot.line);
  if (line === null) return;

  const options = {};
  if (Number(snapshot.over) > 0) options[`OVER_${line}`] = Number(snapshot.over);
  if (Number(snapshot.under) > 0) options[`UNDER_${line}`] = Number(snapshot.under);
  if (Object.keys(options).length) markets[marketKey] = options;
};

const addHandicapMarket = (markets, marketKey, source, status) => {
  const snapshot = getOddsSnapshot(source, status, ['home', 'away']);
  if (!snapshot) return;
  const line = Number(snapshot.line);
  if (!Number.isFinite(line)) return;

  const options = {};
  if (Number(snapshot.home) > 0) {
    options[`Home_${line > 0 ? '+' : ''}${formatLine(line)}`] = Number(snapshot.home);
  }
  if (Number(snapshot.away) > 0) {
    const awayLine = -line;
    options[`Away_${awayLine > 0 ? '+' : ''}${formatLine(awayLine)}`] = Number(snapshot.away);
  }
  if (Object.keys(options).length) markets[marketKey] = options;
};

const normalizeApiMarkets = (apiOdds, status = 'UPCOMING') => {
  const markets = {};
  const oneXTwo = getOddsSnapshot(apiOdds?.['1x2'] || apiOdds?.['1X2'], status, ['home', 'draw', 'away']);
  if (oneXTwo) {
    const options = {};
    if (Number(oneXTwo.home) > 0) options['1'] = Number(oneXTwo.home);
    if (Number(oneXTwo.draw) > 0) options.X = Number(oneXTwo.draw);
    if (Number(oneXTwo.away) > 0) options['2'] = Number(oneXTwo.away);
    if (Object.keys(options).length) markets['1X2'] = options;
  }

  const btts = getOddsSnapshot(apiOdds?.btts, status, ['yes', 'no']);
  if (btts) {
    const options = {};
    if (Number(btts.yes) > 0) options.Yes = Number(btts.yes);
    if (Number(btts.no) > 0) options.No = Number(btts.no);
    if (Object.keys(options).length) markets.BTTS = options;
  }

  addOverUnderMarket(markets, 'Over_Under', apiOdds?.goal_line ?? apiOdds?.goalline, status);
  addHandicapMarket(markets, 'Asian_Handicap', apiOdds?.asian_handicap ?? apiOdds?.asian, status);
  addOverUnderMarket(markets, 'Corner_Line', apiOdds?.corner_line ?? apiOdds?.corner, status);
  addHandicapMarket(markets, 'Corner_Asian', apiOdds?.corner_asian, status);
  addOverUnderMarket(markets, 'Card_Line', apiOdds?.card_line ?? apiOdds?.cards, status);
  addHandicapMarket(markets, 'Card_Asian', apiOdds?.card_asian ?? apiOdds?.cards_asian, status);
  addHandicapMarket(markets, 'Asian_Handicap_Half', apiOdds?.asian_handicap_half ?? apiOdds?.asian_half, status);
  addOverUnderMarket(markets, 'Goal_Line_Half', apiOdds?.goal_line_half ?? apiOdds?.goalline_half, status);
  addOverUnderMarket(markets, 'Corner_Line_Half', apiOdds?.corner_line_half ?? apiOdds?.corner_half, status);

  const fixedGoalLines = apiOdds?.goal_line_fixed || apiOdds?.goalline_fixed;
  if (Array.isArray(fixedGoalLines)) {
    const options = {};
    for (const item of fixedGoalLines) {
      const snapshot = getOddsSnapshot(item, status, ['over', 'under']);
      const line = formatLine(item.line);
      if (!snapshot || line === null) continue;
      if (Number(snapshot.over) > 0) options[`OVER_${line}`] = Number(snapshot.over);
      if (Number(snapshot.under) > 0) options[`UNDER_${line}`] = Number(snapshot.under);
    }
    if (Object.keys(options).length) markets.Goal_Line_Fixed = options;
  }

  return markets;
};

const getFixturesPage = async (params) => {
  const response = await axios.get(`${API_BASE_URL}/fixtures`, {
    params,
    headers: { 'X-API-Key': process.env.FOOTBALL_API_KEY },
    timeout: 15000
  });
  const payload = response.data;

  if (!payload || payload.success !== 1 || !Array.isArray(payload.data)) {
    const message = payload?.error?.message || 'Football API returned an invalid fixtures response';
    throw new Error(message);
  }

  return payload;
};

const fetchFixtures = async (params) => {
  const fixtures = [];
  let page = 1;
  let hasMore = true;
  const includeOdds = params.include?.split(',').includes('odds');
  const perPage = includeOdds ? 50 : params.status === 'live' ? 500 : 100;

  while (hasMore) {
    const payload = await getFixturesPage({ ...params, page, per_page: perPage });
    fixtures.push(...payload.data);
    hasMore = Boolean(payload.pagination?.has_more);
    page += 1;
  }

  return fixtures;
};

const fetchFixturesWithOdds = async (params) => {
  if (fixtureOddsIncludeAvailable === false) return fetchFixtures(params);

  try {
    const fixtures = await fetchFixtures({ ...params, include: 'odds' });
    fixtureOddsIncludeAvailable = true;
    return fixtures;
  } catch (error) {
    if (error.response?.status !== 403 || error.response?.data?.error?.code !== 'insufficient_plan') {
      throw error;
    }

    fixtureOddsIncludeAvailable = false;
    console.warn('[FOOTBALL API] This plan does not include fixture-list odds; fixtures will be synced without odds');
    return fetchFixtures(params);
  }
};

const saveMatch = async (matchData) => {
  const existing = await Match.findOne({
    where: {
      source: API_MATCH_SOURCE,
      external_id: matchData.external_id
    }
  });

  if (existing) {
    const updateData = Array.isArray(matchData.markets) && matchData.markets.length > 0
      ? matchData
      : {
        ...matchData,
        odds: existing.odds,
        markets: existing.markets
      };
    const wasLive = existing.status === 'LIVE';
    await existing.update(updateData);

    if (wasLive && matchData.status === 'FINISHED' && socketServer) {
      const score = matchData.current_score || existing.current_score || {};
      socketServer.emit('match_finished', {
        match_id: existing.id,
        final_score: {
          homeScore: Number(score.home ?? score.homeScore ?? 0),
          awayScore: Number(score.away ?? score.awayScore ?? 0)
        }
      });
    }
  } else {
    await Match.create(matchData);
  }
};

const saveFixtures = async (fixtures) => {
  let saved = 0;

  for (const fixture of fixtures) {
    try {
      await saveMatch(normalizeFixture(fixture));
      saved += 1;
    } catch (error) {
      console.error(`[FOOTBALL API] Could not store fixture ${fixture?.id ?? 'unknown'}: ${error.message}`);
    }
  }

  return saved;
};

const getLiveFixtures = async ({ forceRefresh = false } = {}) => {
  if (!process.env.FOOTBALL_API_KEY) {
    throw new Error('FOOTBALL_API_KEY is not configured');
  }
  if (!forceRefresh && cachedLiveFixtures && Date.now() - cachedLiveFixturesAt < LIVE_CACHE_TTL_MS) {
    return cachedLiveFixtures;
  }
  if (liveFixturesRequest) return liveFixturesRequest;

  liveFixturesRequest = fetchFixturesWithOdds({ status: 'live' })
    .then((fixtures) => fixtures
      .map(normalizeFixture)
      .filter((match) => match.status === 'LIVE')
      .map((match) => ({ ...match, id: `football-api-${match.external_id}` })))
    .then((fixtures) => {
      return saveNormalizedFixtures(fixtures).then(() => {
        cachedLiveFixtures = fixtures;
        cachedLiveFixturesAt = Date.now();
        return fixtures;
      });
    })
    .finally(() => {
      liveFixturesRequest = null;
    });

  return liveFixturesRequest;
};

const getLiveFixturesForClient = async () => {
  const fixtures = await getLiveFixtures();
  if (!fixtures.length) return [];

  const storedMatches = await Match.findAll({
    where: {
      source: API_MATCH_SOURCE,
      external_id: fixtures.map((fixture) => fixture.external_id)
    }
  });
  const storedByExternalId = new Map(
    storedMatches.map((match) => [String(match.external_id), match.toJSON()])
  );

  return fixtures.map((fixture) => {
    const storedMatch = storedByExternalId.get(fixture.external_id);
    return storedMatch
      ? { ...storedMatch, ...fixture, id: storedMatch.id }
      : fixture;
  });
};

const getFixtureMarkets = async (externalId, status = 'UPCOMING') => {
  const fixtureId = String(externalId || '');
  if (!/^\d+$/.test(fixtureId)) {
    throw new Error('Fixture id is invalid');
  }
  const fixtureStatus = status === 'LIVE' ? 'LIVE' : 'UPCOMING';
  if (!process.env.FOOTBALL_API_KEY) {
    throw new Error('FOOTBALL_API_KEY is not configured');
  }

  const cacheKey = `${fixtureId}:${fixtureStatus}`;
  const cached = fixtureOddsCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < FIXTURE_ODDS_CACHE_TTL_MS) {
    return cached.markets;
  }
  if (fixtureOddsRequests.has(cacheKey)) {
    return fixtureOddsRequests.get(cacheKey);
  }

  const request = axios.get(`${API_BASE_URL}/fixtures/${fixtureId}/odds`, {
    headers: { 'X-API-Key': process.env.FOOTBALL_API_KEY },
    timeout: 15000
  }).then(async (response) => {
    const payload = response.data;
    if (payload?.success !== 1 || !payload.data) {
      throw new Error(payload?.error?.message || 'Football API returned invalid fixture odds');
    }

    const bookmakers = payload.data.bookmakers || [];
    const bookmaker = bookmakers.find((item) => item.slug === 'bet365') || bookmakers[0];
    if (!bookmaker?.odds) {
      throw new Error('Football API returned no bookmaker odds for this fixture');
    }

    const referenceOdds = normalizeApiMarkets(bookmaker.odds, fixtureStatus);
    const odds = generateMatchOdds(referenceOdds['1X2'], referenceOdds, {
      oddsSeed: String(fixtureId)
    });
    const match = await Match.findOne({
      where: { source: API_MATCH_SOURCE, external_id: String(fixtureId) }
    });
    const homeTeam = match?.home_team || payload.data.home_team || 'Home';
    const awayTeam = match?.away_team || payload.data.away_team || 'Away';
    const markets = toMarketArray(odds, homeTeam, awayTeam);
    if (match) await match.update({ odds, markets });

    const fixtureOdds = {
      ...payload.data,
      raw_markets: referenceOdds,
      markets
    };
    fixtureOddsCache.set(cacheKey, { markets: fixtureOdds, cachedAt: Date.now() });
    return fixtureOdds;
  }).finally(() => {
    fixtureOddsRequests.delete(cacheKey);
  });

  fixtureOddsRequests.set(cacheKey, request);
  return request;
};

const saveNormalizedFixtures = async (matches) => {
  let saved = 0;

  for (const match of matches) {
    try {
      const { id, ...matchData } = match;
      await saveMatch(matchData);
      saved += 1;
    } catch (error) {
      console.error(`[FOOTBALL API] Could not store fixture ${match.external_id}: ${error.message}`);
    }
  }

  return saved;
};

const syncScheduledFixtures = async () => {
  const utcToday = new Date();
  utcToday.setUTCHours(0, 0, 0, 0);
  let succeeded = true;
  let savedFixtures = 0;

  for (let day = 0; day < FIXTURE_LOOKAHEAD_DAYS; day += 1) {
    const startTime = Math.floor((utcToday.getTime() + day * 24 * 60 * 60 * 1000) / 1000);

    try {
      const fixtures = await fetchFixturesWithOdds({
        start_time: startTime,
        end_time: startTime + 24 * 60 * 60,
        status: 'all'
      });
      const saved = await saveFixtures(fixtures);
      savedFixtures += saved;
      console.log(`[FOOTBALL API] Synced ${saved} fixtures for UTC day ${day + 1}/${FIXTURE_LOOKAHEAD_DAYS}`);
    } catch (error) {
      succeeded = false;
      console.error(`[FOOTBALL API] Fixture sync failed for UTC day ${day + 1}: ${error.message}`);
    }
  }

  return { succeeded, saved: savedFixtures };
};

const syncLiveFixtures = async () => {
  const fixtures = await getLiveFixtures({ forceRefresh: true });
  const liveIds = new Set(fixtures.map((fixture) => String(fixture.external_id)));
  const storedLiveFixtures = await Match.findAll({
    where: { source: API_MATCH_SOURCE, status: 'LIVE' },
    attributes: ['id', 'external_id']
  });
  for (const fixture of storedLiveFixtures) {
    const externalId = String(fixture.external_id);
    if (liveIds.has(externalId)) {
      fixtureStatusCheckTimes.delete(externalId);
    }
  }

  const fixturesToVerify = storedLiveFixtures
    .filter((fixture) => !liveIds.has(String(fixture.external_id)))
    .sort((first, second) => (
      (fixtureStatusCheckTimes.get(String(first.external_id)) || 0)
      - (fixtureStatusCheckTimes.get(String(second.external_id)) || 0)
    ));
  let finished = 0;
  let checked = 0;

  for (const fixture of fixturesToVerify) {
    const externalId = String(fixture.external_id);
    const lastCheckedAt = fixtureStatusCheckTimes.get(externalId) || 0;
    if (checked >= MAX_FIXTURE_STATUS_CHECKS_PER_SYNC
      || Date.now() - lastCheckedAt < FIXTURE_STATUS_RECHECK_INTERVAL_MS) {
      continue;
    }

    fixtureStatusCheckTimes.set(externalId, Date.now());
    checked += 1;

    try {
      const response = await axios.get(`${API_BASE_URL}/fixtures/${encodeURIComponent(externalId)}`, {
        headers: { 'X-API-Key': process.env.FOOTBALL_API_KEY },
        timeout: 15000
      });
      const payload = response.data;
      if (payload?.success !== 1 || !payload.data) {
        throw new Error(payload?.error?.message || 'Football API returned an invalid fixture response');
      }

      const match = normalizeFixture(payload.data);
      if (match.status !== 'FINISHED') continue;

      await saveMatch(match);
      fixtureStatusCheckTimes.delete(externalId);
      finished += 1;
    } catch (error) {
      console.error(`[FOOTBALL API] Could not verify fixture ${externalId} final status: ${error.message}`);
    }
  }

  console.log(`[FOOTBALL API] Synced ${fixtures.length} live fixtures; verified ${finished} finished fixtures`);
};

const syncFootballFixtures = async () => {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const storedFixtureCount = await Match.count({
      where: { source: API_MATCH_SOURCE }
    });
    const fixturesWereDeleted = lastScheduledSyncHadFixtures && storedFixtureCount === 0;

    if (Date.now() >= nextFixtureSyncAt || fixturesWereDeleted) {
      if (fixturesWereDeleted) {
        console.warn('[FOOTBALL API] Stored fixtures are missing; refreshing scheduled fixtures');
      }

      const { succeeded, saved } = await syncScheduledFixtures();
      lastScheduledSyncHadFixtures = saved > 0;
      nextFixtureSyncAt = Date.now() + (
        succeeded && saved > 0 ? FIXTURE_SYNC_INTERVAL_MS : FIXTURE_RETRY_INTERVAL_MS
      );
    }
    await syncLiveFixtures();
  } catch (error) {
    console.error(`[FOOTBALL API] Live fixture sync failed: ${error.message}`);
  } finally {
    syncInProgress = false;
  }
};

const startFootballApiSync = (io = null) => {
  socketServer = io;

  if (!process.env.FOOTBALL_API_KEY) {
    console.warn('[FOOTBALL API] FOOTBALL_API_KEY is not configured; external fixture sync is disabled');
    return;
  }

  cron.schedule(LIVE_SYNC_CRON, syncFootballFixtures);
  void syncFootballFixtures();
};

module.exports = {
  startFootballApiSync,
  normalizeFixture,
  normalizeApiMarkets,
  getLiveFixtures,
  getLiveFixturesForClient,
  getFixtureMarkets
};
