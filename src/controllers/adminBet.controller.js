// controllers/adminBet.controller.js
const adminBetService = require('../services/adminBet.service');

const getAllBets = async (req, res) => {
  try {
    const { status, result, limit, offset } = req.query;
    const data = await adminBetService.getAllBets({ status, result, limit, offset });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBetDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const bet = await adminBetService.getBetDetails(id);
    res.json({ success: true, data: bet });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const updateBetSelections = async (req, res) => {
  try {
    const { id } = req.params;
    const { selections } = req.body;
    const updatedBet = await adminBetService.updateBetSelections(id, selections);
    res.json({ success: true, message: 'Bet updated successfully', data: updatedBet });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const approveBet = async (req, res) => {
  try {
    const { id } = req.params;
    const { result } = req.body;
    const updatedBet = await adminBetService.approveBet(id, result);
    res.json({ success: true, message: `Bet approved as ${result}`, data: updatedBet });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteBet = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminBetService.deleteBet(id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const getStatistics = async (req, res) => {
  try {
    const stats = await adminBetService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllBets,
  getBetDetails,
  updateBetSelections,
  approveBet,
  deleteBet,
  getStatistics
};