const basketballService = require('../services/basketball.service');

// CREATE
const createBasketballMatch = async (req, res) => {
  try {
    const match = await basketballService.createBasketballMatch(req.body);
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET all
const getAllBasketballMatches = async (req, res) => {
  try {
    const matches = await basketballService.getAllBasketballMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET by ID
const getBasketballMatchById = async (req, res) => {
  try {
    const match = await basketballService.getBasketballMatchById(req.params.id);
    res.json(match);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

// UPDATE
const updateBasketballMatch = async (req, res) => {
  try {
    const match = await basketballService.updateBasketballMatch(req.params.id, req.body);
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
const deleteBasketballMatch = async (req, res) => {
  try {
    const result = await basketballService.deleteBasketballMatch(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  createBasketballMatch,
  getAllBasketballMatches,
  getBasketballMatchById,
  updateBasketballMatch,
  deleteBasketballMatch
};