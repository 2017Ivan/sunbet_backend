const FootballMatch = require('../models/football.model');

const createMatch = async (data) => {
  return await FootballMatch.create(data);
};

const findAllMatches = async () => {
  return await FootballMatch.findAll();
};

const findMatchById = async (id) => {
  return await FootballMatch.findByPk(id);
};

const updateMatch = async (id, data) => {
  return await FootballMatch.update(data, { where: { id } });
};

const deleteMatch = async (id) => {
  return await FootballMatch.destroy({ where: { id } });
};

module.exports = {
  createMatch,
  findAllMatches,
  findMatchById,
  updateMatch,
  deleteMatch
};