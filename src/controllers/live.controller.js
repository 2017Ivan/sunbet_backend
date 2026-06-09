const liveService = require('../services/live.service');

// CREATE
const createLiveMatch = async (req, res) => {
  try {
      const match = await liveService.createLiveMatch(req.body);
      res.status(201).json(match);
    } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET all
const getAllLiveMatches = async (req, res) => {
  try {
      const matches = await liveService.getAllLiveMatches();
      res.json(matches);
    } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET by ID
const getLiveMatchById = async (req, res) => {
  try {
      const match = await liveService.getLiveMatchById(req.params.id);
      res.json(match);
    } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

// UPDATE
const updateLiveMatch = async (req, res) => {
  try {
    const match = await liveService.updateLiveMatch(req.params.id, req.body);
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
const deleteLiveMatch = async (req, res) => {
  try {
    const result = await liveService.deleteLiveMatch(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  createLiveMatch,
  getAllLiveMatches,
  getLiveMatchById,
  updateLiveMatch,
  deleteLiveMatch
};