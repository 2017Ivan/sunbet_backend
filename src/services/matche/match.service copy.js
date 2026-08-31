const matchRepository = require('../../repositories/match/match.repository');
const { generatePredeterminedScript, generateFullMarkets } = require('../../utils/matchGenerator.util');

const createMatch = async (inputData) => {
  const { match_id, home_team, away_team, date, time, league, odds } = inputData;

  if (!home_team || !away_team || !date || !time || !odds || !odds['1X2']) {
    throw new Error('Tafadhali weka Home Team, Away Team, Date, Time na Odds za 1X2.');
  }

  // 1. Zaa kiotomatiki Predetermined Script (FT, HT, Stats & Full Timeline)
  const autoScript = generatePredeterminedScript(home_team, away_team);

  // 2. Zaa kiotomatiki masoko yote ya Odds (BTTS, Over/Under, Correct Score, n.k.)
  const fullMarkets = generateFullMarkets(odds['1X2']);

  // 3. Andaa Data tayari kuingia kwenye Database
  const finalMatchData = {
    match_code: match_id || `MCH-${Date.now()}`,
    home_team,
    away_team,
    league: league || 'General League',
    date,
    time,
    status: inputData.status || 'UPCOMING',
    odds: fullMarkets,
    predetermined_script: autoScript,
    current_score: { home: 0, away: 0 }
  };

  return await matchRepository.createMatch(finalMatchData);
};

const getUpcomingMatches = async () => {
  return await matchRepository.findUpcomingMatches();
};

const getMatchDetails = async (matchId) => {
  const match = await matchRepository.findMatchById(matchId);
  if (!match) {
    throw new Error('Mechi haijapatikana.');
  }
  return match;
};

const updateMatchOdds = async (matchId, newOdds) => {
  const match = await matchRepository.findMatchById(matchId);
  if (!match) {
    throw new Error('Mechi haijapatikana.');
  }
  return await matchRepository.updateMatchOdds(matchId, newOdds);
};

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
  updateMatchOdds,
  updateMatchStatus
};