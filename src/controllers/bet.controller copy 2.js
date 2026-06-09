// controllers/bet.controller.js
const betService = require('../services/bet.service');
const betRepository = require('../repositories/bet.repository'); // Add this
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
 * Load bet by booking code (original - any status)
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
 * Load ONLY active bet (OPEN + PENDING)
 * GET /api/bets/active/:bookingCode
 */
const loadActiveBetByCode = asyncHandler(async (req, res) => {
  const { bookingCode } = req.params;
  
  if (!bookingCode) {
    return res.status(400).json({
      success: false,
      message: 'Booking code is required'
    });
  }
  
  // Use repository to find active bet only
  const bet = await betRepository.findActiveByBookingCode(bookingCode);
  
  if (!bet) {
    // Check if bet exists but is not active
    const existingBet = await betRepository.findByBookingCode(bookingCode);
    
    if (!existingBet) {
      return res.status(404).json({
        success: false,
        message: 'Booking code not found'
      });
    }
    
    // Provide specific message based on bet status
    if (existingBet.status === 'SETTLED') {
      return res.status(400).json({
        success: false,
        message: 'This bet has already been settled and cannot be loaded',
        data: {
          status: existingBet.status,
          result: existingBet.result
        }
      });
    }
    
    if (existingBet.result !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This bet has already been ${existingBet.result.toLowerCase()} and cannot be loaded`,
        data: {
          status: existingBet.status,
          result: existingBet.result
        }
      });
    }
    
    if (!existingBet.isBookingCodeActive) {
      return res.status(400).json({
        success: false,
        message: 'This booking code is no longer active',
        data: {
          status: existingBet.status,
          isActive: false
        }
      });
    }
    
    return res.status(400).json({
      success: false,
      message: `Cannot load this bet. Status: ${existingBet.status}, Result: ${existingBet.result}`,
      data: {
        status: existingBet.status,
        result: existingBet.result
      }
    });
  }
  
  const betData = bet.toJSON();
  betData.selections = JSON.parse(betData.selections);
  
  res.json({
    success: true,
    message: 'Active bet loaded successfully',
    data: betData
  });
});

/**
 * Check booking code status without loading
 * GET /api/bets/check/:bookingCode
 */
const checkBookingCodeStatus = asyncHandler(async (req, res) => {
  const { bookingCode } = req.params;
  
  if (!bookingCode) {
    return res.status(400).json({
      success: false,
      message: 'Booking code is required'
    });
  }
  
  const bet = await betRepository.findByBookingCode(bookingCode);
  
  if (!bet) {
    return res.json({
      success: true,
      exists: false,
      canLoad: false,
      message: 'Booking code not found'
    });
  }
  
  const canLoad = bet.status === 'OPEN' && bet.result === 'PENDING' && bet.isBookingCodeActive;
  
  let message = '';
  if (canLoad) {
    message = 'Bet is active and ready to load';
  } else if (bet.status === 'SETTLED') {
    message = `Bet has been settled (${bet.result})`;
  } else if (bet.result !== 'PENDING') {
    message = `Bet has been ${bet.result.toLowerCase()}`;
  } else if (!bet.isBookingCodeActive) {
    message = 'Booking code is no longer active';
  } else {
    message = `Bet cannot be loaded (Status: ${bet.status}, Result: ${bet.result})`;
  }
  
  res.json({
    success: true,
    data: {
      exists: true,
      canLoad,
      status: bet.status,
      result: bet.result,
      isBookingCodeActive: bet.isBookingCodeActive,
      selectionsCount: bet.selections ? JSON.parse(bet.selections).length : 0,
      stake: bet.stake,
      totalOdds: bet.totalOdds,
      message
    }
  });
});

/**
 * Get booking code details (for preview)
 * GET /api/bets/preview/:bookingCode
 */
const previewBookingCode = asyncHandler(async (req, res) => {
  const { bookingCode } = req.params;
  
  if (!bookingCode) {
    return res.status(400).json({
      success: false,
      message: 'Booking code is required'
    });
  }
  
  const bet = await betRepository.findByBookingCode(bookingCode);
  
  if (!bet) {
    return res.status(404).json({
      success: false,
      message: 'Booking code not found'
    });
  }
  
  // Return preview data without allowing load if not active
  const selections = JSON.parse(bet.selections);
  const canLoad = bet.status === 'OPEN' && bet.result === 'PENDING' && bet.isBookingCodeActive;
  
  res.json({
    success: true,
    data: {
      canLoad,
      status: bet.status,
      result: bet.result,
      selections: canLoad ? selections : null, // Only show selections if can load
      selectionsCount: selections.length,
      stake: bet.stake,
      totalOdds: bet.totalOdds,
      potentialReturn: bet.potentialReturn,
      createdAt: bet.createdAt,
      message: canLoad ? 'Ready to load' : 'Cannot load this bet'
    }
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

module.exports = {
  placeBet,
  loadBetByBookingCode,
  loadActiveBetByCode,
  checkBookingCodeStatus,
  previewBookingCode,
  settleBet,
  getUserBets,
  generateBookingCode,
  getBetById,
  cancelBet,
  getUserBetStats,
  approveBetController
};