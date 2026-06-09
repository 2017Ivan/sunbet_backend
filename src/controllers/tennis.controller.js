const tennisService = require('../services/tennis.service');

// CREATE
const createTennisMatch = async (req, res) => {
  try {
    const match = await tennisService.createTennisMatch(req.body);
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET all
const getAllTennisMatches = async (req, res) => {
  try {
    const matches = await tennisService.getAllTennisMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET by ID
const getTennisMatchById = async (req, res) => {
  try {
    const match = await tennisService.getTennisMatchById(req.params.id);
    res.json(match);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

// UPDATE
const updateTennisMatch = async (req, res) => {
  try {
    const match = await tennisService.updateTennisMatch(req.params.id, req.body);
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
const deleteTennisMatch = async (req, res) => {
  try {
    const result = await tennisService.deleteTennisMatch(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  createTennisMatch,
  getAllTennisMatches,
  getTennisMatchById,
  updateTennisMatch,
  deleteTennisMatch
};