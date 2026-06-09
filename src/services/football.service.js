const footballRepository = require('../repositories/football.repository');

// Format response (optional)
const formatResponse = (match) => {
  if (!match) return null;
  return match.toJSON ? match.toJSON() : match;
};

// CREATE
const createFootballMatch = async (data) => {
  const match = await footballRepository.createMatch(data);
  return formatResponse(match);
};

// GET all
const getAllFootballMatches = async () => {
  const matches = await footballRepository.findAllMatches();
  return matches.map(formatResponse);
};

// GET by ID
const getFootballMatchById = async (id) => {
  const match = await footballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');
  return formatResponse(match);
};

// UPDATE (partial update supported)
const updateFootballMatch = async (id, data) => {
  const match = await footballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await footballRepository.updateMatch(id, data);

  const updatedMatch = await footballRepository.findMatchById(id);
  return formatResponse(updatedMatch);
};

// DELETE
const deleteFootballMatch = async (id) => {
  const match = await footballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await footballRepository.deleteMatch(id);
  return { message: 'Football match deleted successfully' };
};

module.exports = {
  createFootballMatch,
  getAllFootballMatches,
  getFootballMatchById,
  updateFootballMatch,
  deleteFootballMatch
};