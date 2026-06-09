const efootballService = require('../services/efootball.service');

// CREATE
const createEfootballMatch = async (req, res) => {
  try {
    const match = await efootballService.createEfootballMatch(req.body);
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET all
const getAllEfootballMatches = async (req, res) => {
  try {
    const matches = await efootballService.getAllEfootballMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET by ID
const getEfootballMatchById = async (req, res) => {
  try {
    const match = await efootballService.getEfootballMatchById(req.params.id);
    res.json(match);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

// UPDATE
const updateEfootballMatch = async (req, res) => {
  try {
    const match = await efootballService.updateEfootballMatch(req.params.id, req.body);
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
const deleteEfootballMatch = async (req, res) => {
  try {
    const result = await efootballService.deleteEfootballMatch(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  createEfootballMatch,
  getAllEfootballMatches,
  getEfootballMatchById,
  updateEfootballMatch,
  deleteEfootballMatch
};