const footballService = require('../services/football.service');

// CREATE
const createFootballMatch = async (req, res) => {
  try {
    const match = await footballService.createFootballMatch(req.body);
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET all
const getAllFootballMatches = async (req, res) => {
  try {
    const matches = await footballService.getAllFootballMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET by ID
const getFootballMatchById = async (req, res) => {
  try {
    const match = await footballService.getFootballMatchById(req.params.id);
    res.json(match);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

// UPDATE
const updateFootballMatch = async (req, res) => {
  try {
    const match = await footballService.updateFootballMatch(req.params.id, req.body);
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
const deleteFootballMatch = async (req, res) => {
  try {
    const result = await footballService.deleteFootballMatch(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  createFootballMatch,
  getAllFootballMatches,
  getFootballMatchById,
  updateFootballMatch,
  deleteFootballMatch
};