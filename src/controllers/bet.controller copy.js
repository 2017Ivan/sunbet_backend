// controllers/bet.controller.js
const betService = require('../services/bet.service');
const {
  ValidationError,
  AuthenticationError,
  asyncHandler
} = require('../utils/errors');

/**
 * Place a new bet
 * POST /api/bets/place
 */
const placeBet = asyncHandler(async (req, res) => {
  const { selections, stake } = req.body;
  const userId = req.user.id;

  const result = await betService.placeBet(userId, selections, stake);

  res.status(201).json({
    success: true,
    message: 'Bet placed successfully',
    data: result
  });
});

/**
 * Load bet by booking code
 * GET /api/bets/load/:bookingCode
 */
const loadBetByBookingCode = asyncHandler(async (req, res) => {
  const { bookingCode } = req.params;

  const bet = await betService.loadBetByBookingCode(bookingCode);

  res.json({
    success: true,
    data: bet
  });
});

/**
 * Settle bet (admin only)
 * PATCH /api/bets/:betId/settle
 */
const settleBet = asyncHandler(async (req, res) => {
  const { betId } = req.params;
  const { result } = req.body;

  // Check if user is admin
  if (!req.user.isAdmin) {
    throw new AuthenticationError('Admin access required');
  }

  const updatedBet = await betService.settleBet(betId, result);

  res.json({
    success: true,
    message: `Bet settled as ${result}`,
    data: updatedBet
  });
});

/**
 * Get user's bets
 * GET /api/bets/user
 */
const getUserBets = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, result, limit = 50, offset = 0 } = req.query;

  // Validate pagination
  const pageLimit = Math.min(parseInt(limit) || 50, 100);
  const pageOffset = parseInt(offset) || 0;

  const resultData = await betService.getUserBets(userId, {
    status,
    result,
    limit: pageLimit,
    offset: pageOffset
  });

  res.json({
    success: true,
    data: {
      total: resultData.total,
      bets: resultData.bets,
      pagination: {
        limit: pageLimit,
        offset: pageOffset,
        hasMore: pageOffset + pageLimit < resultData.total
      }
    }
  });
});

/**
 * Generate new booking code for existing bet
 * POST /api/bets/:betId/generate-booking-code
 */
const generateBookingCode = asyncHandler(async (req, res) => {
  const { betId } = req.params;

  // Check if user owns this bet
  const bet = await betService.getBetById(betId);
  
  if (bet.userId !== req.user.id && !req.user.isAdmin) {
    throw new AuthenticationError('You can only generate codes for your own bets');
  }

  const result = await betService.generateNewBookingCode(betId);

  res.json({
    success: true,
    message: 'New booking code generated successfully',
    data: result
  });
});

/**
 * Get bet by ID
 * GET /api/bets/:betId
 */
const getBetById = asyncHandler(async (req, res) => {
  const { betId } = req.params;

  const bet = await betService.getBetById(betId);

  // Check if user has permission to view this bet
  if (bet.userId !== req.user.id && !req.user.isAdmin) {
    throw new AuthenticationError('You can only view your own bets');
  }

  res.json({
    success: true,
    data: bet
  });
});

/**
 * Cancel bet (before settlement)
 * PATCH /api/bets/:betId/cancel
 */
const cancelBet = asyncHandler(async (req, res) => {
  const { betId } = req.params;
  const userId = req.user.id;

  const bet = await betService.getBetById(betId);

  // Only owner or admin can cancel
  if (bet.userId !== userId && !req.user.isAdmin) {
    throw new AuthenticationError('You can only cancel your own bets');
  }

  const cancelledBet = await betService.cancelBet(betId, userId);

  res.json({
    success: true,
    message: 'Bet cancelled successfully',
    data: cancelledBet
  });
});
// PATCH /bets/:id/approve
const approveBetController = async (req, res) => {
  try {
    const { id } = req.params;
    const { result } = req.body; // WON or LOST

    const updatedBet = await betService.approveBet(id, result);

    res.json(updatedBet);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Get bet statistics for user
 * GET /api/bets/stats
 */
const getUserBetStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const stats = await betService.getUserBetStats(userId);

  res.json({
    success: true,
    data: stats
  });
});



const loadActiveBetByCode = asyncHandler(async (req, res) => {
  const { bookingCode } = req.params;
  
  // Find bet - only OPEN and PENDING
  const bet = await Bet.findOne({
    where: {
      bookingCode,
      status: 'OPEN',
      result: 'PENDING',
      isBookingCodeActive: true
    }
  });
  
  if (!bet) {
    return res.status(404).json({
      success: false,
      message: 'No active bet found with this code. Bet may be settled or expired.'
    });
  }
  
  const betData = bet.toJSON();
  betData.selections = JSON.parse(betData.selections);
  
  res.json({
    success: true,
    data: betData
  });
});
module.exports = {
  placeBet,
  loadBetByBookingCode,
  settleBet,
  getUserBets,
  generateBookingCode,
  loadActiveBetByCode,
  getBetById,
  cancelBet,
  getUserBetStats,
  approveBetController
};