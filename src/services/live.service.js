const liveRepository = require('../repositories/live.repository');

// Format response (optional)
const formatResponse = (match) => {
  if (!match) return null;
  return match.toJSON ? match.toJSON() : match;
};

// CREATE
const createLiveMatch = async (data) => {
  const match = await liveRepository.createMatch(data);
  return formatResponse(match);
};

// GET all
const getAllLiveMatches = async () => {
  const matches = await liveRepository.findAllMatches();
  return matches.map(formatResponse);
};

// GET by ID
const getLiveMatchById = async (id) => {
  const match = await liveRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');
  return formatResponse(match);
};

// UPDATE (partial update supported)
const updateLiveMatch = async (id, data) => {
  const match = await liveRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await liveRepository.updateMatch(id, data);

  const updatedMatch = await liveRepository.findMatchById(id);
  return formatResponse(updatedMatch);
};

// DELETE
const deleteLiveMatch = async (id) => {
  const match = await liveRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await liveRepository.deleteMatch(id);
  return { message: 'Football match deleted successfully' };
};

module.exports = {
  createLiveMatch,
  getAllLiveMatches,
  getLiveMatchById,
  updateLiveMatch,
  deleteLiveMatch
};