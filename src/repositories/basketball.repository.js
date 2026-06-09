const BasketballMatch = require('../models/basketball.model');

const createMatch = async (data) => {
  return await BasketballMatch.create(data);
};

const findAllMatches = async () => {
  return await BasketballMatch.findAll();
};

const findMatchById = async (id) => {
  return await BasketballMatch.findByPk(id);
};

const updateMatch = async (id, data) => {
  return await BasketballMatch.update(data, { where: { id } });
};

const deleteMatch = async (id) => {
  return await BasketballMatch.destroy({ where: { id } });
};

module.exports = {
  createMatch,
  findAllMatches,
  findMatchById,
  updateMatch,
  deleteMatch
};