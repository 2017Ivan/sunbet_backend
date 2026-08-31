// repositories/match/match.repositoriy.js 

const { Match } = require('../../models');

const createMatch = async (matchData, transaction = null) => {
  return await Match.create(matchData, { transaction });
};
// ============ NEW: BULK CREATE ============
const bulkCreateMatches = async (matchesData, transaction = null) => {
  return await Match.bulkCreate(matchesData, { transaction });
};

const findMatchById = async (id) => {
  return await Match.findByPk(id);
};

const findMatchesByIds = async (ids) => {
  return await Match.findAll({
    where: { id: ids }
  });
};

const findMatchByCode = async (matchCode) => {
  return await Match.findOne({
    where: { match_code: matchCode }
  });
};

const findUpcomingMatches = async () => {
  return await Match.findAll({
    where: { status: 'UPCOMING' },
    order: [['date', 'ASC'], ['time', 'ASC']]
  });
};

const findLiveMatches = async () => {
  return await Match.findAll({
    where: { status: 'LIVE' }
  });
};

const updateMatchStatus = async (id, status, transaction = null) => {
  const [updatedRows] = await Match.update(
    { status },
    { where: { id }, transaction }
  );
  return updatedRows > 0;
};

const updateMatchCurrentScore = async (id, currentScore, transaction = null) => {
  const [updatedRows] = await Match.update(
    { current_score: currentScore },
    { where: { id }, transaction }
  );
  return updatedRows > 0;
};

module.exports = {
  createMatch,
  bulkCreateMatches,
  findMatchById,
  findMatchesByIds,
  findMatchByCode,
  findUpcomingMatches,
  findLiveMatches,
  updateMatchStatus,
  updateMatchCurrentScore
};