// repositories/bookingcode/bookingCode.repository.js

const { Op } = require('sequelize');
const { BookingCode } = require('../../models');

/**
 * Create a new booking code
 */
const create = async (data) => {
  return await BookingCode.create(data);
};

/**
 * Find booking code by its code string
 */
const findByCode = async (code) => {
  return await BookingCode.findOne({
    where: { code }
  });
};

/**
 * Find booking code by ID
 */
const findById = async (id) => {
  return await BookingCode.findByPk(id);
};

/**
 * Find active booking code (not expired)
 */
const findActiveByCode = async (code) => {
  const now = new Date();
  
  return await BookingCode.findOne({
    where: {
      code,
      status: 'ACTIVE',
      expiresAt: {
        [Op.gt]: now
      }
    }
  });
};

/**
 * Get all booking codes by user
 */
const findByUserId = async (userId) => {
  return await BookingCode.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Get all booking codes (admin only)
 */
const findAll = async (options = {}) => {
  const { limit = 100, offset = 0, status } = options;
  
  const where = {};
  if (status) where.status = status;
  
  return await BookingCode.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Update booking code status
 */
const updateStatus = async (id, status) => {
  const bookingCode = await BookingCode.findByPk(id);
  if (!bookingCode) return null;
  
  return await bookingCode.update({ status });
};

/**
 * Update selection score inside booking code
 * @param {string} bookingCodeId - Booking code ID
 * @param {string} matchId - Match ID
 * @param {number} homeScore - Home team score
 * @param {number} awayScore - Away team score
 */
const updateSelectionScore = async (bookingCodeId, matchId, homeScore, awayScore) => {
  const bookingCode = await BookingCode.findByPk(bookingCodeId);
  if (!bookingCode) return null;
  
  const selections = bookingCode.selections || [];
  
  // Find and update the specific selection
  const updatedSelections = selections.map(selection => {
    if (selection.matchId === matchId) {
      return {
        ...selection,
        score: { home: homeScore, away: awayScore },
        // Automatically determine result based on selection type
        result: determineResult(selection.selectionType, homeScore, awayScore)
      };
    }
    return selection;
  });
  
  // Check if any selection was updated
  const isUpdated = updatedSelections.some((sel, index) => 
    JSON.stringify(sel) !== JSON.stringify(selections[index])
  );
  
  if (!isUpdated) {
    return null;
  }
  
  await bookingCode.update({ selections: updatedSelections });
  return bookingCode;
};

/**
 * Determine result based on selection type and scores
 */
const determineResult = (selectionType, homeScore, awayScore) => {
  switch (selectionType) {
    case 'HOME':
      return homeScore > awayScore ? 'WON' : 'LOST';
    case 'DRAW':
      return homeScore === awayScore ? 'WON' : 'LOST';
    case 'AWAY':
      return awayScore > homeScore ? 'WON' : 'LOST';
    default:
      return 'PENDING';
  }
};

/**
 * Delete expired booking codes
 */
const deleteExpired = async () => {
  const now = new Date();
  return await BookingCode.destroy({
    where: {
      expiresAt: { [Op.lt]: now },
      status: 'EXPIRED'
    }
  });
};

module.exports = {
  create,
  findByCode,
  findById,
  findActiveByCode,
  findByUserId,
  findAll,
  updateStatus,
  updateSelectionScore,
  deleteExpired
};