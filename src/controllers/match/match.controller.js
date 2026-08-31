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

// ============ NEW: BULK CREATE ============
const createMultipleMatches = async (req, res) => {
  try {
    const { matches } = req.body;
    const result = await matchService.createMultipleMatches(matches);
    
    return res.status(201).json({
      success: true,
      message: `${result.successCount} mechi zimeundwa kikamilifu.`,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============ NEW: UPLOAD FILE ============
const uploadMatchesFile = async (req, res) => {
  try {
    // Hii inategemea library ya file parsing (csv-parser, xlsx)
    // Kwa sasa tunadhani file imeparswa na middleware
    const fileData = req.fileData || [];
    const result = await matchService.uploadMatchesFromFile(fileData);
    
    return res.status(201).json({
      success: true,
      message: `${result.successCount} mechi zimeundwa kikamilifu kutoka kwenye file.`,
      data: result
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

const getLiveMatches = async (req, res) => {
  try {
    const matches = await matchService.getLiveMatches();
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

// ============ NEW: AUTO-GENERATE RANDOM MATCHES ============
const generateMatches = async (req, res) => {
  try {
    const { count, league, daysFrom, daysTo } = req.body || {};
    const result = await matchService.generateRandomMatches({
      count,
      league,
      daysFrom,
      daysTo
    });

    return res.status(201).json({
      success: true,
      message: `${result.total} mechi zimezalishwa kikamilifu (${result.league}).`,
      data: result
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
  uploadMatchesFile,
  getLiveMatches, 
  getMatchDetails,
  updateMatchOdds,
  createMultipleMatches,
  updateMatchStatus,
  generateMatches
};