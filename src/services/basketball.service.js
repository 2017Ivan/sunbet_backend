const basketballRepository = require('../repositories/basketball.repository');

// Format response (optional)
const formatResponse = (match) => {
  if (!match) return null;
  return match.toJSON ? match.toJSON() : match;
};

// CREATE
const createBasketballMatch = async (data) => {
  const match = await basketballRepository.createMatch(data);
  return formatResponse(match);
};

// GET all
const getAllBasketballMatches = async () => {
  const matches = await basketballRepository.findAllMatches();
  return matches.map(formatResponse);
};

// GET by ID
const getBasketballMatchById = async (id) => {
  const match = await basketballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');
  return formatResponse(match);
};

// UPDATE (partial update supported)
const updateBasketballMatch = async (id, data) => {
  const match = await basketballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await basketballRepository.updateMatch(id, data);

  const updatedMatch = await basketballRepository.findMatchById(id);
  return formatResponse(updatedMatch);
};

// DELETE
const deleteBasketballMatch = async (id) => {
  const match = await basketballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await basketballRepository.deleteMatch(id);
  return { message: 'Football match deleted successfully' };
};

module.exports = {
  createBasketballMatch,
  getAllBasketballMatches,
  getBasketballMatchById,
  updateBasketballMatch,
  deleteBasketballMatch
};