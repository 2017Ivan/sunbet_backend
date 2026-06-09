const LiveMatch = require('../models/live.model');

const createMatch = async (data) => {
  return await LiveMatch.create(data);
};

const findAllMatches = async () => {
  return await LiveMatch.findAll();
};

const findMatchById = async (id) => {
  return await LiveMatch.findByPk(id);
};

const updateMatch = async (id, data) => {
  return await LiveMatch.update(data, { where: { id } });
};

const deleteMatch = async (id) => {
  return await LiveMatch.destroy({ where: { id } });
};

module.exports = {
  createMatch,
  findAllMatches,
  findMatchById,
  updateMatch,
  deleteMatch
};