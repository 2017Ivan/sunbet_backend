
// services/matche/match.service.js 
const matchRepository = require('../../repositories/match/match.repository');
const footballApiService = require('../footballApi/footballApi.service');
const {
  generatePredeterminedScript,
  generateMatchOdds,
  normalizeBaseOdds
} = require('../../utils/matchGenerator.util');
const { toMarketArray } = require('../../utils/marketArray.util');
const { getCurrentMatchMarkets } = require('../../utils/matchPricing.util');
const {
  generateFixturesTeams,
  generateFixtureScheduleOnDay,
  pickRandomLeague
} = require('../../utils/fixtureGenerator.util');

// ============ NEW: AUTO-GENERATE RANDOM MATCHES ============
// `day` follows JS convention: 0 = Sunday, 1 = Monday ... 6 = Saturday.
// When `day` is null the schedule falls back to a random day.
const generateRandomMatches = async ({ count = 5, league = null, daysFrom = 1, daysTo = 7, day = null } = {}) => {
  const num = Math.max(1, Math.min(50, parseInt(count) || 5));
  const leagueName = (league && String(league).trim()) || pickRandomLeague();
  const from = Math.max(0, parseInt(daysFrom) || 1);
  const to = Math.max(from, parseInt(daysTo) || 7);

  const teams = generateFixturesTeams(num);
  const createdMatches = [];

  for (let i = 0; i < num; i++) {
    const pair = teams[i];
    if (!pair) continue;

    const { home_team, away_team } = pair;
    const schedule = generateFixtureScheduleOnDay(day, from, to);
    const autoScript = generatePredeterminedScript(home_team, away_team);
    const referenceOdds = { '1X2': { '1': 2.4, X: 3.2, '2': 2.8 } };
    const matchCode = `AUTO-${Date.now()}-${i + 1}`;
    const fullMarkets = generateMatchOdds(referenceOdds['1X2'], referenceOdds, { oddsSeed: matchCode });

    const matchData = {
      match_code: matchCode,
      home_team,
      away_team,
      league: leagueName,
      date: schedule.date,
      time: schedule.time,
      status: 'UPCOMING',
      odds: fullMarkets,
      markets: toMarketArray(fullMarkets, home_team, away_team),
      predetermined_script: autoScript,
      current_score: {
        home: autoScript.final_ft.homeScore,
        away: autoScript.final_ft.awayScore
      }
    };

    const match = await matchRepository.createMatch(matchData);
    createdMatches.push(match);
  }

  return {
    created: createdMatches,
    total: createdMatches.length,
    league: leagueName,
    day: day === null || day === undefined ? null : parseInt(day, 10)
  };
};

const createMatch = async (inputData) => {
  const { match_id, home_team, away_team, date, time, league, odds } = inputData;
  const base1X2 = normalizeBaseOdds(odds?.['1X2'] || {});

  if (!home_team || !away_team || !date || !time
    || Object.values(base1X2).some((value) => !value || value <= 1)) {
    throw new Error('Tafadhali weka Home Team, Away Team, Date, Time na Odds za 1X2.');
  }

  // 1. Zaa kiotomatiki Predetermined Script (FT, HT, Stats & Full Timeline)
  const autoScript = generatePredeterminedScript(home_team, away_team);
  const matchCode = match_id || `MCH-${Date.now()}`;

  const referenceOdds = {
    ...odds,
    '1X2': base1X2
  };
  const fullMarkets = generateMatchOdds(referenceOdds['1X2'], referenceOdds, { oddsSeed: matchCode });

  // 3. Andaa Data tayari kuingia kwenye Database
  const finalMatchData = {
    match_code: matchCode,
    home_team,
    away_team,
    league: league || 'General League',
    date,
    time,
    status: inputData.status || 'UPCOMING',
    odds: fullMarkets,
    markets: toMarketArray(fullMarkets, home_team, away_team),
    predetermined_script: autoScript,
    current_score: {
      home: autoScript.final_ft.homeScore,
      away: autoScript.final_ft.awayScore
    }
  };

  return await matchRepository.createMatch(finalMatchData);
};


// ============ NEW: BULK CREATE MATCHES ============
const createMultipleMatches = async (matchesData) => {
  if (!matchesData || !Array.isArray(matchesData) || matchesData.length === 0) {
    throw new Error('Tafadhali toa angalau mechi moja.');
  }

  const createdMatches = [];
  const errors = [];

  for (let i = 0; i < matchesData.length; i++) {
    const data = matchesData[i];
    try {
      if (!data.home_team || !data.away_team || !data.date || !data.time) {
        errors.push(`Match #${i + 1}: Home Team, Away Team, Date na Time zinahitajika.`);
        continue;
      }

      const autoScript = generatePredeterminedScript(data.home_team, data.away_team);
      const sourceOdds = data.odds || {};
      const base1X2 = normalizeBaseOdds(sourceOdds['1X2'] || {});
      if (Object.values(base1X2).some((value) => !value || value <= 1)) {
        errors.push(`Match #${i + 1}: Odds zote za 1X2 zinahitajika.`);
        continue;
      }
      const referenceOdds = {
        ...sourceOdds,
        '1X2': base1X2
      };
      const matchCode = data.match_id || `MCH-${Date.now()}-${i}`;
      const fullMarkets = generateMatchOdds(referenceOdds['1X2'], referenceOdds, { oddsSeed: matchCode });

      const matchData = {
        match_code: matchCode,
        home_team: data.home_team,
        away_team: data.away_team,
        league: data.league || 'General League',
        date: data.date,
        time: data.time,
        status: data.status || 'UPCOMING',
        odds: fullMarkets,
        markets: toMarketArray(fullMarkets, data.home_team, data.away_team),
        predetermined_script: autoScript,
        current_score: {
          home: autoScript.final_ft.homeScore,
          away: autoScript.final_ft.awayScore
        }
      };

      const match = await matchRepository.createMatch(matchData);
      createdMatches.push(match);
    } catch (error) {
      errors.push(`Match #${i + 1}: ${error.message}`);
    }
  }

  if (createdMatches.length === 0 && errors.length > 0) {
    throw new Error(`Hakuna mechi iliyoundwa. Makosa: ${errors.join('; ')}`);
  }

  return {
    created: createdMatches,
    errors: errors,
    total: matchesData.length,
    successCount: createdMatches.length,
    errorCount: errors.length
  };
};

// ============ NEW: UPLOAD MATCHES FROM FILE ============
const uploadMatchesFromFile = async (fileData) => {
  // fileData inaweza kuwa CSV au Excel parsed data
  // Hii itatekeleza kwa kutumia library kama csv-parser au xlsx
  
  if (!fileData || !Array.isArray(fileData) || fileData.length === 0) {
    throw new Error('File haina data yoyote.');
  }

  const matches = fileData.map((row, index) => {
    // Map CSV/Excel columns to match data
    return {
      home_team: row.home_team || row.HomeTeam || row['Home Team'] || row.home,
      away_team: row.away_team || row.AwayTeam || row['Away Team'] || row.away,
      date: row.date || row.Date || row.match_date,
      time: row.time || row.Time || row.match_time,
      league: row.league || row.League || row.league_name || 'General League',
      odds: {
        '1X2': {
          home: parseFloat(row.odds_home || row.oddsHome || row['Odds Home'] || 2.0),
          draw: parseFloat(row.odds_draw || row.oddsDraw || row['Odds Draw'] || 3.0),
          away: parseFloat(row.odds_away || row.oddsAway || row['Odds Away'] || 2.5)
        }
      },
      status: row.status || row.Status || 'UPCOMING'
    };
  });

  return await createMultipleMatches(matches);
};

const getUpcomingMatches = async () => {
  return normalizeMatchResults(await matchRepository.findUpcomingMatches());
};
const getLiveMatches = async () => {
  return normalizeMatchResults(await matchRepository.findLiveMatches());
};
const getFootballApiLiveMatches = async () => {
  return await footballApiService.getLiveFixturesForClient();
};
const getFootballApiMarkets = async (externalId, status) => {
  return await footballApiService.getFixtureMarkets(externalId, status);
};
const getMatchDetails = async (matchId) => {
  const match = await matchRepository.findMatchById(matchId);
  if (!match) {
    throw new Error('Mechi haijapatikana.');
  }
  return normalizeStoredMatch(match);
};

const updateMatchOdds = async (matchId, newOdds) => {
  const match = await matchRepository.findMatchById(matchId);
  if (!match) {
    throw new Error('Mechi haijapatikana.');
  }
  const base1X2 = normalizeBaseOdds(newOdds?.['1X2'] || {});
  if (Object.values(base1X2).some((value) => !value || value <= 1)) {
    throw new Error('Odds zote za 1X2 zinahitajika.');
  }
  const referenceOdds = {
    ...(newOdds || {}),
    '1X2': base1X2
  };
  const odds = generateMatchOdds(referenceOdds['1X2'], referenceOdds, { oddsSeed: match.match_code });
  const markets = toMarketArray(odds, match.home_team, match.away_team);
  await match.update({ odds, markets });
  return match;
};

const normalizeStoredMatch = async (match) => {
  const data = match.get({ plain: true });
  if (Array.isArray(data.markets) && data.markets.length > 0) {
    return { ...data, markets: getCurrentMatchMarkets(data) };
  }

  const storedOdds = data.odds && typeof data.odds === 'object' ? data.odds : {};
  const referenceOdds = data.source === 'FOOTBALL_API'
    ? storedOdds
    : { '1X2': storedOdds['1X2'] || {} };
  const odds = generateMatchOdds(
    normalizeBaseOdds(storedOdds['1X2'] || {}),
    referenceOdds,
    { oddsSeed: data.match_code || data.id }
  );
  const markets = toMarketArray(odds, data.home_team, data.away_team);

  await match.update({ odds, markets });
  const normalized = { ...data, odds, markets };
  return { ...normalized, markets: getCurrentMatchMarkets(normalized) };
};

const normalizeMatchResults = async (matches) => Promise.all(
  matches.map((match) => normalizeStoredMatch(match))
);

const updateMatchStatus = async (matchId, status) => {
  const allowedStatuses = ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'];
  if (!allowedStatuses.includes(status)) {
    throw new Error('Status ya mechi si sahihi.');
  }
  return await matchRepository.updateMatchStatus(matchId, status);
};

module.exports = {
  createMatch,
  getUpcomingMatches,
  getMatchDetails,
  getLiveMatches,
  getFootballApiLiveMatches,
  getFootballApiMarkets,
  updateMatchOdds,
  updateMatchStatus,
  uploadMatchesFromFile,
  createMultipleMatches,
  generateRandomMatches

};