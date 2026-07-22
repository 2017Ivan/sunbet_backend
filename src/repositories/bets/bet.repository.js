// repositories/bets/bet.repository.js

const { sequelize } = require('../../config/database');
const { Op } = require('sequelize');
const { NotFoundError } = require('../../utils/errors');
const { generateRandomId } = require('../../utils/idGenerator');

const { Bet, User, BookingCode } = require('../../models');  // Selection imeondolewa

/**
 * Generate unique random ID for bet
 */
const generateUniqueId = async () => {
  let id;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!isUnique && attempts < maxAttempts) {
    id = generateRandomId();
    const existing = await Bet.findByPk(id);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) {
    const timestamp = Date.now().toString().slice(-3);
    id = generateRandomId().slice(0, 8) + timestamp;
  }
  
  return id;
};

/**
 * Create a new bet
 */
const create = async (betData) => {
  const id = await generateUniqueId();
  return await Bet.create({ id, ...betData });
};

/**
 * Find bet by ID
 */
const findById = async (id) => {
  return await Bet.findByPk(id, {
    include: [
      { model: User, as: 'user' },
      { model: BookingCode, as: 'bookingCode' }
      // Selection imeondolewa
    ]
  });
};

/**
 * Find all bets with filters
 */
const findAll = async (where = {}, options = {}) => {
  const { limit = 100, offset = 0, order = [['createdAt', 'DESC']] } = options;
  
  return await Bet.findAndCountAll({
    where,
    limit,
    offset,
    order,
    include: [
      { 
        model: User, 
        as: 'user',
        attributes: ['id', 'phone_number', 'balance']
      },
      {
        model: BookingCode,
        as: 'bookingCode',
        attributes: ['id', 'code']
      }
      // Selection imeondolewa
    ]
  });
};

/**
 * Find all bets by user
 */
const findByUserId = async (userId, options = {}) => {
  const { status, result, limit = 50, offset = 0 } = options;
  
  const where = { userId };
  
  if (status) where.status = status;
  if (result) where.result = result;
  
  const found = await Bet.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: BookingCode,
        as: 'bookingCode',
        attributes: ['id', 'code']
      }
      // Selection imeondolewa
    ]
  });
  
  return {
    bets: found.rows,
    count: found.count
  };
};

/**
 * Find bets by booking code ID
 */
const findByBookingCodeId = async (bookingCodeId, options = {}) => {
  const { limit = 100, offset = 0 } = options;
  
  return await Bet.findAndCountAll({
    where: { bookingCodeId },
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'phone_number', 'balance']
      }
      // Selection imeondolewa
    ]
  });
};

/**
 * Update bet
 */
const update = async (id, updateData) => {
  const bet = await Bet.findByPk(id);
  if (!bet) return null;
  
  return await bet.update(updateData);
};

/**
 * Settle bet (update status and result)
 */
const settleBet = async (id, result) => {
  const bet = await Bet.findByPk(id);
  if (!bet) return null;
  
  return await bet.update({
    status: 'SETTLED',
    result: result,
    settledAt: new Date()
  });
};

/**
 * Cancel bet
 */
const cancelBet = async (id) => {
  const bet = await Bet.findByPk(id);
  if (!bet) return null;
  
  return await bet.update({
    status: 'CANCELLED'
  });
};

/**
 * Get user's total bet count and amount
 */
const getUserBetStats = async (userId) => {
  const stats = await Bet.findAll({
    where: { userId },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalBets'],
      [sequelize.fn('SUM', sequelize.col('stake')), 'totalStake'],
      [sequelize.fn('SUM', sequelize.col('potentialReturn')), 'totalPotentialReturn'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN result = 'WON' THEN 1 END")), 'wonBets'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN result = 'LOST' THEN 1 END")), 'lostBets'],
      [sequelize.fn('SUM', sequelize.literal("CASE WHEN result = 'WON' THEN potentialReturn ELSE 0 END")), 'totalWon']
    ],
    raw: true
  });

  return stats[0] || {
    totalBets: 0,
    totalStake: 0,
    totalPotentialReturn: 0,
    wonBets: 0,
    lostBets: 0,
    totalWon: 0
  };
};

/**
 * Get bet with all relations
 */
const getBetWithRelations = async (id) => {
  return await Bet.findByPk(id, {
    include: [
      { 
        model: User, 
        as: 'user',
        attributes: ['id', 'balance', 'phone_number']
      },
      {
        model: BookingCode,
        as: 'bookingCode'
      }
      // Selection imeondolewa
    ]
  });
};

/**
 * Find bets by status
 */
const findByStatus = async (status, options = {}) => {
  const { limit = 100, offset = 0 } = options;
  
  return await Bet.findAndCountAll({
    where: { status },
    limit,
    offset,
    order: [['createdAt', 'ASC']]
    // Selection imeondolewa
  });
};

/**
 * Find pending bets that need settlement
 */
const findPendingBets = async () => {
  return await Bet.findAll({
    where: {
      status: 'OPEN',
      result: 'PENDING'
    }
    // Selection imeondolewa
  });
};

/**
 * Find unchecked winning bets
 */
const findUncheckedWins = async (userId) => {
  return await Bet.findAll({
    where: {
      userId,
      result: 'WON',
      isWinningNotified: false
    },
    order: [['settledAt', 'DESC']]
    // Selection imeondolewa
  });
};

module.exports = {
  create,
  findById,
  findAll,
  findByUserId,
  findByBookingCodeId,
  update,
  settleBet,
  cancelBet,
  getUserBetStats,
  getBetWithRelations,
  findByStatus,
  findPendingBets,
  findUncheckedWins
};