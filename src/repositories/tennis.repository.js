const TennisMatch = require('../models/tennis.model');

const createMatch = async (data) => {
  return await TennisMatch.create(data);
};

const findAllMatches = async () => {
  return await TennisMatch.findAll();
};

const findMatchById = async (id) => {
  return await TennisMatch.findByPk(id);
};

const updateMatch = async (id, data) => {
  return await TennisMatch.update(data, { where: { id } });
};

const deleteMatch = async (id) => {
  return await TennisMatch.destroy({ where: { id } });
};

module.exports = {
  createMatch,
  findAllMatches,
  findMatchById,
  updateMatch,
  deleteMatch
};