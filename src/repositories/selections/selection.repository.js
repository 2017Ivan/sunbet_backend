// repositories/selections/selection.repository.js

const { Op } = require('sequelize');
const { Selection, BookingCode, Bet } = require('../../models');

/**
 * Create a new selection
 */
const create = async (data) => {
  return await Selection.create(data);
};

/**
 * Create multiple selections (bulk)
 */
const bulkCreate = async (selectionsData) => {
  return await Selection.bulkCreate(selectionsData);
};

/**
 * Find selection by ID
 */
const findById = async (id) => {
  return await Selection.findByPk(id, {
    include: [
      {
        model: BookingCode,
        as: 'bookingCode'
      },
      {
        model: Bet,
        as: 'bets'
      }
    ]
  });
};

/**
 * Find all selections by booking code ID
 */
const findByBookingCodeId = async (bookingCodeId) => {
  return await Selection.findOne({
    where: { bookingCodeId },
    include: [
      {
        model: BookingCode,
        as: 'bookingCode'
      }
    ]
  });
};

/**
 * Find selection by match ID
 */
const findByMatchId = async (matchId) => {
  return await Selection.findAll({
    where: { matchId },
    include: [
      {
        model: BookingCode,
        as: 'bookingCode',
        attributes: ['id', 'code']
      }
    ]
  });
};

/**
 * Update selection score (home and away)
 */
const updateScore = async (id, homeScore, awayScore) => {
  const selection = await Selection.findByPk(id);
  if (!selection) return null;
  
  const score = { home: homeScore, away: awayScore };
  
  return await selection.update({
    score: score
  });
};

/**
 * Update selection score and result
 */
const updateScoreAndResult = async (id, homeScore, awayScore, result) => {
  const selection = await Selection.findByPk(id);
  if (!selection) return null;
  
  const score = { home: homeScore, away: awayScore };
  
  return await selection.update({
    score: score,
    result: result,
    isSettled: true,
    settledAt: new Date()
  });
};

/**
 * Update multiple selections scores
 */
const bulkUpdateScores = async (selectionsData) => {
  // selectionsData should be array of { id, homeScore, awayScore }
  const updates = selectionsData.map(async (data) => {
    const score = { home: data.homeScore, away: data.awayScore };
    return await Selection.update(
      { score },
      { where: { id: data.id } }
    );
  });
  
  return await Promise.all(updates);
};

/**
 * Get selections by status (pending, won, lost)
 */
const findByResult = async (result, options = {}) => {
  const { limit = 100, offset = 0 } = options;
  
  return await Selection.findAndCountAll({
    where: { result },
    limit,
    offset,
    include: [
      {
        model: BookingCode,
        as: 'bookingCode',
        attributes: ['id', 'code']
      }
    ],
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Get pending selections (not settled yet)
 */
const findPendingSelections = async () => {
  return await Selection.findAll({
    where: {
      result: 'PENDING',
      isSettled: false
    },
    include: [
      {
        model: BookingCode,
        as: 'bookingCode',
        attributes: ['id', 'code']
      }
    ],
    order: [['createdAt', 'ASC']]
  });
};

/**
 * Get selections by match name (search)
 */
const findByMatchName = async (searchTerm) => {
  return await Selection.findAll({
    where: {
      matchName: {
        [Op.like]: `%${searchTerm}%`
      }
    },
    include: [
      {
        model: BookingCode,
        as: 'bookingCode',
        attributes: ['id', 'code']
      }
    ]
  });
};

/**
 * Update selection result
 */
const updateResult = async (id, result) => {
  const selection = await Selection.findByPk(id);
  if (!selection) return null;
  
  return await selection.update({
    result: result,
    isSettled: true,
    settledAt: new Date()
  });
};

/**
 * Check if selection exists
 */
const exists = async (id) => {
  const selection = await Selection.findByPk(id);
  return !!selection;
};

/**
 * Delete selection (soft delete or hard delete)
 */
const deleteSelection = async (id) => {
  const selection = await Selection.findByPk(id);
  if (!selection) return null;
  
  return await selection.destroy();
};

/**
 * Get selections with bets count
 */
const getSelectionsWithBetCount = async (bookingCodeId) => {
  return await Selection.findAll({
    where: { bookingCodeId },
    attributes: {
      include: [
        [
          sequelize.fn('COUNT', sequelize.col('bets.id')),
          'betCount'
        ]
      ]
    },
    include: [
      {
        model: Bet,
        as: 'bets',
        attributes: []
      }
    ],
    group: ['Selection.id'],
    order: [['createdAt', 'ASC']]
  });
};

module.exports = {
  create,
  bulkCreate,
  findById,
  findByBookingCodeId,
  findByMatchId,
  updateScore,
  updateScoreAndResult,
  bulkUpdateScores,
  findByResult,
  findPendingSelections,
  findByMatchName,
  updateResult,
  exists,
  deleteSelection,
  getSelectionsWithBetCount
};