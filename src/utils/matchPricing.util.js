const { toMarketArray } = require('./marketArray.util');
const { getCorrectScoreOdds } = require('./matchGenerator.util');

const PREMATCH_REPRICE_MINUTES = 30;
const PREMATCH_MAX_REDUCTION = 0.05;
const LIVE_MAX_REDUCTION = 0.05;
const LIVE_MARKET_LOCK_MINUTE = 85;
const GENERATED_ODDS_MAX = 15;
const GENERATED_ODDS_RANDOM_MIN = 4;
const LATE_LOCKED_MARKETS = new Set([
  'Correct_Score',
  'Total_Goals',
  'BTTS_Win',
  'Odd_Even'
]);

const getKickoffTime = (match) => {
  const date = String(match?.date || '');
  const time = String(match?.time || '').trim().toLowerCase();
  const parts = time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!date || !parts) return null;

  let hours = Number(parts[1]);
  const minutes = Number(parts[2]);
  if (parts[3] === 'pm' && hours < 12) hours += 12;
  if (parts[3] === 'am' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  const kickoff = new Date(
    `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  );
  return Number.isNaN(kickoff.getTime()) ? null : kickoff;
};

const getMatchElapsedMinute = (match, now = new Date()) => {
  const kickoff = getKickoffTime(match);
  if (!kickoff) return null;

  const wallMinutes = Math.floor((now.getTime() - kickoff.getTime()) / 60000);
  if (wallMinutes <= 0) return 0;

  const script = match?.predetermined_script || {};
  const firstHalfEnd = 45 + (Number(script.extra_time_mins?.ht) || 1);
  const halftimeBreak = Number(script.halftime_break_mins) || 15;
  if (wallMinutes > firstHalfEnd + halftimeBreak) return wallMinutes - halftimeBreak;
  if (wallMinutes > firstHalfEnd) return firstHalfEnd;
  return wallMinutes;
};

const getStoredMarkets = (match) => (
  Array.isArray(match.markets) && match.markets.length > 0
    ? match.markets
    : toMarketArray(match.odds, match.home_team, match.away_team)
);

const seededRandom = (seed) => {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) / 0x100000000;
};

const applyGeneratedOddsRange = (markets, match) => {
  if (match.source === 'FOOTBALL_API') return markets;

  return markets.map((market) => ({
    ...market,
    selections: market.selections.map((selection) => {
      const odds = Number(selection.odds);
      if (market.market === 'Correct Score | Full Time') {
        return {
          ...selection,
          odds: getCorrectScoreOdds(match.match_code || match.id || '', selection.name)
        };
      }
      if (market.market === '1X2 | Full Time' || odds < GENERATED_ODDS_MAX) return selection;

      const seed = `${match.match_code || match.id}:${market.market}:${selection.name}`;
      const randomizedOdds = GENERATED_ODDS_RANDOM_MIN
        + seededRandom(seed) * (GENERATED_ODDS_MAX - GENERATED_ODDS_RANDOM_MIN);
      return { ...selection, odds: Number(randomizedOdds.toFixed(2)) };
    })
  }));
};

const getCurrentMatchMarkets = (match, { now = new Date(), elapsedMinute } = {}) => {
  if (!match || typeof match !== 'object') return [];
  const storedMarkets = applyGeneratedOddsRange(getStoredMarkets(match), match);

  if (match.source === 'FOOTBALL_API') return storedMarkets;

  if (match.status === 'LIVE') {
    const minute = Math.max(0, Number(elapsedMinute ?? getMatchElapsedMinute(match, now)) || 0);
    const extraTime = Number(match.predetermined_script?.extra_time_mins?.ft) || 5;
    const matchDuration = 90 + extraTime;
    const progress = Math.min(1, minute / matchDuration);
    const priceFactor = 1 - PREMATCH_MAX_REDUCTION - LIVE_MAX_REDUCTION * progress;
    return applyPriceFactor(storedMarkets, priceFactor);
  }

  if (match.status !== 'UPCOMING') return storedMarkets;

  const kickoff = getKickoffTime(match);
  if (!kickoff) return storedMarkets;
  const minutesUntilKickoff = (kickoff.getTime() - now.getTime()) / 60000;
  if (minutesUntilKickoff <= 0 || minutesUntilKickoff > PREMATCH_REPRICE_MINUTES) {
    return storedMarkets;
  }

  const reduction = PREMATCH_MAX_REDUCTION
    * ((PREMATCH_REPRICE_MINUTES - minutesUntilKickoff) / PREMATCH_REPRICE_MINUTES);
  const priceFactor = 1 - reduction;
  return applyPriceFactor(storedMarkets, priceFactor);
};

const applyPriceFactor = (markets, priceFactor) => markets.map((market) => ({
    ...market,
    selections: market.selections.map((selection) => ({
      ...selection,
      odds: Math.max(1.01, Number((Number(selection.odds) * priceFactor).toFixed(2)))
    }))
  }));

const isLiveSelectionLocked = (match, marketKey, odds, elapsedMinute) => {
  if (!match) return true;
  if (['FINISHED', 'CANCELLED'].includes(match.status)) return true;
  if (match.status !== 'LIVE') return false;

  const minute = elapsedMinute ?? getMatchElapsedMinute(match);
  if (minute === null || minute === undefined || !Number.isFinite(Number(minute))) return true;
  if (minute < LIVE_MARKET_LOCK_MINUTE) return false;
  return LATE_LOCKED_MARKETS.has(marketKey) || Number(odds) <= 1.15;
};

const isCorrectScoreOutcomeImpossible = (match, marketKey, outcomeKey) => {
  if (!match || match.status !== 'LIVE' || marketKey !== 'Correct_Score') return false;

  const scoreline = String(outcomeKey).match(/^(\d+)[-_](\d+)$/);
  const currentHome = Number(match.current_score?.home);
  const currentAway = Number(match.current_score?.away);
  if (!scoreline || !Number.isFinite(currentHome) || !Number.isFinite(currentAway)) return false;

  return Number(scoreline[1]) < currentHome || Number(scoreline[2]) < currentAway;
};

module.exports = {
  getKickoffTime,
  getMatchElapsedMinute,
  getCurrentMatchMarkets,
  isLiveSelectionLocked,
  isCorrectScoreOutcomeImpossible
};
