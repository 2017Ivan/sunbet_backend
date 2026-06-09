const efootballRepository = require('../repositories/efootball.repository');

// Format response (optional)
const formatResponse = (match) => {
  if (!match) return null;
  return match.toJSON ? match.toJSON() : match;
};

// CREATE
const createEfootballMatch = async (data) => {
  const match = await efootballRepository.createMatch(data);
  return formatResponse(match);
};

// GET all
const getAllEfootballMatches = async () => {
  const matches = await efootballRepository.findAllMatches();
  return matches.map(formatResponse);
};

// GET by ID
const getEfootballMatchById = async (id) => {
  const match = await efootballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');
  return formatResponse(match);
};

// UPDATE (partial update supported)
const updateEfootballMatch = async (id, data) => {
  const match = await efootballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await efootballRepository.updateMatch(id, data);

  const updatedMatch = await efootballRepository.findMatchById(id);
  return formatResponse(updatedMatch);
};

// DELETE
const deleteEfootballMatch = async (id) => {
  const match = await efootballRepository.findMatchById(id);
  if (!match) throw new Error('Football match not found');

  await efootballRepository.deleteMatch(id);
  return { message: 'Football match deleted successfully' };
};

module.exports = {
  createEfootballMatch,
  getAllEfootballMatches,
  getEfootballMatchById,
  updateEfootballMatch,
  deleteEfootballMatch
};