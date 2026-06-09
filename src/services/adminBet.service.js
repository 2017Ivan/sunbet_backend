// services/adminBet.service.js
const adminBetRepository = require('../repositories/adminBet.repository');
const userRepository = require('../repositories/user.repository');

const getAllBets = async (filters) => {
  return await adminBetRepository.getAllBets(filters);
};

const getBetDetails = async (betId) => {
  const bet = await adminBetRepository.getBetById(betId);
  if (!bet) throw new Error('Bet not found');
  return bet;
};

const updateBetSelections = async (betId, selections) => {
    const bet = await adminBetRepository.getBetById(betId);
    if (!bet) throw new Error('Bet not found');
    if (bet.status !== 'OPEN') throw new Error('Cannot edit settled or cancelled bets');
    
    if (!Array.isArray(selections) || selections.length === 0) {
      throw new Error('Selections must be a non-empty array');
    }
    
    // Allow any user input for selection value
    selections.forEach((selection, index) => {
      // Only check if selection exists and is not empty
      if (!selection.selection || typeof selection.selection !== 'string' || selection.selection.trim() === '') {
        throw new Error(`Selection ${index + 1} must have a valid selection value`);
      }
      // Odds validation - must be greater than 1
      const oddsValue = parseFloat(selection.odds);
      if (isNaN(oddsValue) || oddsValue <= 1) {
        throw new Error(`Selection ${index + 1} must have valid odds > 1`);
      }
    });
    
    await adminBetRepository.updateBetSelections(betId, selections);
    return await adminBetRepository.getBetById(betId);
  };

const approveBet = async (betId, result) => {
  if (!['WON', 'LOST'].includes(result)) {
    throw new Error('Result must be WON or LOST');
  }
  
  const bet = await adminBetRepository.getBetById(betId);
  if (!bet) throw new Error('Bet not found');
  if (bet.status === 'SETTLED') throw new Error('Bet already settled');
  
  await adminBetRepository.updateBetResult(betId, result);
  
  if (result === 'WON') {
    await userRepository.addBalance(bet.userId, parseFloat(bet.potentialReturn));
  }
  
  return await adminBetRepository.getBetById(betId);
};

const deleteBet = async (betId) => {
  const bet = await adminBetRepository.getBetById(betId);
  if (!bet) throw new Error('Bet not found');
  await adminBetRepository.deleteBet(betId);
  return { message: 'Bet deleted successfully' };
};

const getStatistics = async () => {
  return await adminBetRepository.getStatistics();
};

module.exports = {
  getAllBets,
  getBetDetails,
  updateBetSelections,
  approveBet,
  deleteBet,
  getStatistics
};