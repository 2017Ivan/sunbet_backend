const EfootballMatch = require('../models/efootball.model');

const createMatch = async (data) => {
  return await EfootballMatch.create(data);
};

const findAllMatches = async () => {
  return await EfootballMatch.findAll();
};

const findMatchById = async (id) => {
  return await EfootballMatch.findByPk(id);
};

const updateMatch = async (id, data) => {
  return await EfootballMatch.update(data, { where: { id } });
};

const deleteMatch = async (id) => {
  return await EfootballMatch.destroy({ where: { id } });
};

module.exports = {
  createMatch,
  findAllMatches,
  findMatchById,
  updateMatch,
  deleteMatch
};