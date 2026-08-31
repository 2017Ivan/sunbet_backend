// controllers/match/match.controller.js 
const matchService = require('../../services/matche/match.service');

const createMatch = async (req, res) => {
  try {
    const match = await matchService.createMatch(req.body);
    return res.status(201).json({
      success: true,
      message: 'Mechi imeundwa kikamilifu.',
      data: match
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const getUpcomingMatches = async (req, res) => {
  try {
    const matches = await matchService.getUpcomingMatches();
    return res.status(200).json({
      success: true,
      data: matches
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getMatchDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await matchService.getMatchDetails(id);
    return res.status(200).json({
      success: true,
      data: match
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

const updateMatchOdds = async (req, res) => {
  try {
    const { id } = req.params;
    const { odds } = req.body;
    const updatedMatch = await matchService.updateMatchOdds(id, odds);
    
    return res.status(200).json({
      success: true,
      message: 'Odds zimeboreshwa kikamilifu.',
      data: updatedMatch
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const updateMatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedMatch = await matchService.updateMatchStatus(id, status);

    return res.status(200).json({
      success: true,
      message: 'Status ya mechi imebadilishwa kikamilifu.',
      data: updatedMatch
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createMatch,
  getUpcomingMatches,
  getMatchDetails,
  updateMatchOdds,
  updateMatchStatus
};