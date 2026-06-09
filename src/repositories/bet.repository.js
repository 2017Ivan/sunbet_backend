// repositories/bet.repository.js

const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const { NotFoundError } = require('../utils/errors');
const { generateRandomId } = require('../utils/idGenerator');

const { Bet, User } = require('../models'); // Import from index (not individual files)


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
    // If we hit max attempts, add timestamp suffix
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
  return await Bet.findByPk(id);
};

/**
 * Find bet by booking code
 */
const findByBookingCode = async (bookingCode) => {
  return await Bet.findOne({
    where: { bookingCode }
  });
};

/**
 * Find active bet by booking code (OPEN and PENDING)
 */
// const findActiveByBookingCode = async (bookingCode) => {
//   return await Bet.findOne({
//     where: {
//       bookingCode,
//       status: 'OPEN',
//       result: 'PENDING',
//       isBookingCodeActive: true
//     }
//   });
// };

// repositories/bet.repository.js

/**
 * Find all bets with pagination (for admin)
 */

const findAll = async (where = {}, options = {}) => {
  const { limit = 100, offset = 0, order = [['createdAt', 'DESC']] } = options;
  
  return await Bet.findAndCountAll({
    where,
    limit,
    offset,
    order,
    include: [{
      model: User,
      as: 'user',  // This matches the alias in Bet.associate
      attributes: ['id', 'phone_number', 'balance']
    }]
  });
};







const findActiveByBookingCode = async (bookingCode) => {
  return await Bet.findOne({
    where: {
      bookingCode,
      status: 'OPEN',
      result: 'PENDING',
      isBookingCodeActive: true
    }
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
  
  const found = await Bet.findAndCountAll({  // Use different variable name
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  // Return in the format expected by the service
  return {
    bets: found.rows,    // Map rows to bets
    count: found.count
  };
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
    settledAt: new Date(),
    isBookingCodeActive: false // Deactivate booking code once settled
  });
};

/**
 * Cancel bet
 */
const cancelBet = async (id) => {
  const bet = await Bet.findByPk(id);
  if (!bet) return null;
  
  return await bet.update({
    status: 'CANCELLED',
    isBookingCodeActive: false
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
 * Get bet with user details
 */
const getBetWithUser = async (id) => {
  return await Bet.findByPk(id, {
    include: [{
      model: require('../models/user.model'),
      attributes: ['id', 'username', 'email', 'balance']
    }]
  });
};

/**
 * Check if booking code exists
 */
const bookingCodeExists = async (bookingCode) => {
  const bet = await Bet.findOne({
    where: { bookingCode }
  });
  return !!bet;
};


const findUncheckedWins = async (userId) => {
  return await Bet.findAll({
    where: {
      userId,
      result: 'WON',
      isWinningNotified: false  // ← unahitaji kuongeza column hii
    },
    order: [['settledAt', 'DESC']]
  });
};


module.exports = {
  create,
  findById,
  findByBookingCode,
  findActiveByBookingCode,
  findByUserId,
  update,
  settleBet,
  cancelBet,
  getUserBetStats,
  getBetWithUser,
  bookingCodeExists,
  findAll,
  findUncheckedWins
};