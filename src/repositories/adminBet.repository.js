// repositories/adminBet.repository.js
const { Bet, User, sequelize } = require('../models');

/**
 * Get ALL bets from ALL users - NO userId filter
 */
const getAllBets = async (filters = {}) => {
  const { status, result, limit = 100, offset = 0 } = filters;
  
  // Build where clause - IMPORTANT: No userId filter here!
  let where = {};
  if (status) where.status = status;
  if (result) where.result = result;
  
  // Remove any userId that might sneak in
  delete where.userId;
  
  console.log('🔍 Admin getAllBets - where clause:', where);
  
  const { count, rows } = await Bet.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']],
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'phone_number', 'balance']
    }]
  });
  
  console.log(`📊 Found ${count} total bets from ALL users`);
  
  const formattedBets = rows.map(bet => {
    const betData = bet.toJSON();
    try {
      betData.selections = typeof betData.selections === 'string' 
        ? JSON.parse(betData.selections) 
        : betData.selections;
    } catch (e) {
      betData.selections = [];
    }
    return betData;
  });
  
  return {
    total: count,
    bets: formattedBets,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + parseInt(limit) < count
    }
  };
};

/**
 * Get single bet with user details
 */
const getBetById = async (betId) => {
  const bet = await Bet.findByPk(betId, {
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'phone_number', 'balance']
    }]
  });
  
  if (!bet) return null;
  
  const betData = bet.toJSON();
  try {
    betData.selections = typeof betData.selections === 'string' 
      ? JSON.parse(betData.selections) 
      : betData.selections;
  } catch (e) {
    betData.selections = [];
  }
  
  return betData;
};

/**
 * Update bet selections
 */
const updateBetSelections = async (betId, selections) => {
  const bet = await Bet.findByPk(betId);
  if (!bet) return null;
  
  if (bet.status !== 'OPEN') {
    throw new Error('Cannot edit settled or cancelled bets');
  }
  
  let totalOdds = 1;
  selections.forEach(selection => {
    totalOdds *= parseFloat(selection.odds);
  });
  
  const potentialReturn = parseFloat(bet.stake) * totalOdds;
  
  bet.selections = JSON.stringify(selections);
  bet.totalOdds = totalOdds;
  bet.potentialReturn = potentialReturn;
  
  await bet.save();
  
  return bet;
};

/**
 * Update bet result (approve)
 */
const updateBetResult = async (betId, result) => {
  const bet = await Bet.findByPk(betId);
  if (!bet) return null;
  
  bet.result = result;
  bet.status = 'SETTLED';
  bet.settledAt = new Date();
  bet.isBookingCodeActive = false;
  
  await bet.save();
  
  return bet;
};

/**
 * Delete bet
 */
const deleteBet = async (betId) => {
  const bet = await Bet.findByPk(betId);
  if (!bet) return null;
  await bet.destroy();
  return true;
};

/**
 * Get statistics from ALL bets
 */
const getStatistics = async () => {
  const stats = await Bet.findAll({
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalBets'],
      [sequelize.fn('SUM', sequelize.col('stake')), 'totalStake'],
      [sequelize.fn('SUM', sequelize.col('potentialReturn')), 'totalPotentialReturn'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'OPEN' THEN 1 END")), 'pendingBets'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN result = 'WON' THEN 1 END")), 'wonBets'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN result = 'LOST' THEN 1 END")), 'lostBets'],
      [sequelize.fn('SUM', sequelize.literal("CASE WHEN result = 'WON' THEN potentialReturn ELSE 0 END")), 'totalPaidOut']
    ],
    raw: true
  });
  
  const result = stats[0] || {};
  return {
    totalBets: parseInt(result.totalBets || 0),
    totalStake: parseFloat(result.totalStake || 0),
    totalPotentialReturn: parseFloat(result.totalPotentialReturn || 0),
    pendingBets: parseInt(result.pendingBets || 0),
    wonBets: parseInt(result.wonBets || 0),
    lostBets: parseInt(result.lostBets || 0),
    totalPaidOut: parseFloat(result.totalPaidOut || 0)
  };
};

module.exports = {
  getAllBets,
  getBetById,
  updateBetSelections,
  updateBetResult,
  deleteBet,
  getStatistics
};