const tennisRepository = require('../repositories/tennis.repository');

// Format response (optional)
const formatResponse = (match) => {
  if (!match) return null;
  return match.toJSON ? match.toJSON() : match;
};

// CREATE
const createTennisMatch = async (data) => {
  const match = await tennisRepository.createMatch(data);
  return formatResponse(match);
};

// GET all
const getAllTennisMatches = async () => {
  const matches = await tennisRepository.findAllMatches();
  return matches.map(formatResponse);
};

// GET by ID
const getTennisMatchById = async (id) => {
  const match = await tennisRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');
  return formatResponse(match);
};

// UPDATE (partial update supported)
const updateTennisMatch = async (id, data) => {
  const match = await tennisRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await tennisRepository.updateMatch(id, data);

  const updatedMatch = await tennisRepository.findMatchById(id);
  return formatResponse(updatedMatch);
};

// DELETE
const deleteTennisMatch = async (id) => {
  const match = await tennisRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await tennisRepository.deleteMatch(id);
  return { message: 'Football match deleted successfully' };
};

module.exports = {
  createTennisMatch,
  getAllTennisMatches,
  getTennisMatchById,
  updateTennisMatch,
  deleteTennisMatch
};