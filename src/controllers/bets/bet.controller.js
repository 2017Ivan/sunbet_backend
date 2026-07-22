// controllers/bets/bet.controller.js

const betRepository = require('../../repositories/bets/bet.repository');
const betService = require('../../services/bets/bet.service');
const bookingCodeService = require('../../services/bookingcode/bookingCode.service');

// ============ USER ROUTES ============

/**
 * GET /api/bets - Get user's own bets
 */
const getUserBets = async (req, res) => {
  console.log("getUserBets called");
  try {
    const userId = req.user.id;
    const { status, result, limit = 50, offset = 0 } = req.query;

    const where = { userId };
    if (status) where.status = status;
    if (result) where.result = result;

    const bets = await betRepository.findAll(where, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        total: bets.count,
        bets: bets.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < bets.count
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * GET /api/bets/:id - Get user's own bet by ID
 */
const getBetById = async (req, res) => {
  try {
    const userId = req.user.id;
    const bet = await betRepository.findById(req.params.id);

    if (!bet) {
      return res.status(404).json({ 
        success: false,
        message: 'Bet not found' 
      });
    }

    if (bet.userId !== userId) {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized' 
      });
    }

    res.json({ 
      success: true, 
      data: bet 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * POST /api/bets/place - Place a bet
 * Body: { selections: [...], stake, bookingCodeId? }
 */
const placeBet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { selections, stake, bookingCodeId } = req.body;

    console.log('📥 Controller received:');
    console.log('📥 userId:', userId);
    console.log('📥 selections:', JSON.stringify(selections, null, 2));
    console.log('📥 stake:', stake);
    console.log('📥 bookingCodeId:', bookingCodeId);

    // Validate inputs
    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one selection is required' 
      });
    }

    if (!stake || stake < 100) {
      return res.status(400).json({ 
        success: false,
        message: 'Minimum stake is 100 TZS' 
      });
    }

    // Place bet using service - bookingCodeId ni optional
    const result = await betService.placeBet(
      userId, 
      selections, 
      stake, 
      bookingCodeId
    );

    res.status(201).json({
      success: true,
      message: 'Bet placed successfully',
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * GET /api/bets/booking-code/:bookingCodeId - Get bets by booking code
 */
const getBetsByBookingCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingCodeId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify booking code belongs to user or user is admin
    const bookingCode = await bookingCodeService.getBookingCodeById(bookingCodeId);
    if (!bookingCode) {
      return res.status(404).json({ 
        success: false,
        message: 'Booking code not found' 
      });
    }

    if (bookingCode.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized' 
      });
    }

    const bets = await betService.getBetsByBookingCode(bookingCodeId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: bets
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * GET /api/bets/stats - Get user's betting statistics
 */
const getUserBetStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await betService.getUserBetStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// ============ ADMIN ROUTES (with role check) ============

/**
 * CHECK ADMIN ROLE
 */
const checkAdmin = (req) => {
  if (req.user.role !== 'ADMIN') {
    throw new Error('Access denied. Admin role required.');
  }
};

/**
 * GET /api/admin/bets - Get all bets (admin only)
 */
const adminGetAllBets = async (req, res) => {
  try {
    checkAdmin(req);

    const { status, result, userId, limit = 100, offset = 0 } = req.query;

    let where = {};
    if (status) where.status = status;
    if (result) where.result = result;
    if (userId) where.userId = userId;

    const bets = await betRepository.findAll(where, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        total: bets.count,
        bets: bets.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < bets.count
        }
      }
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ 
        success: false, 
        message: error.message 
      });
    }
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * GET /api/admin/bets/:id - Get single bet with details (admin only)
 */
const adminGetBetById = async (req, res) => {
  try {
    checkAdmin(req);

    const bet = await betRepository.getBetWithRelations(req.params.id);

    if (!bet) {
      return res.status(404).json({ 
        success: false,
        message: 'Bet not found' 
      });
    }

    res.json({ 
      success: true, 
      data: bet 
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ 
        success: false, 
        message: error.message 
      });
    }
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * PATCH /api/admin/bets/:id/settle - Settle bet (admin only)
 */
const adminSettleBet = async (req, res) => {
  try {
    checkAdmin(req);

    const { id } = req.params;
    const { result } = req.body;

    if (!['WON', 'LOST'].includes(result)) {
      return res.status(400).json({ 
        success: false,
        message: 'Result must be WON or LOST' 
      });
    }

    const updatedBet = await betService.settleBet(id, result);

    res.json({
      success: true,
      message: `Bet settled as ${result}`,
      data: updatedBet
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ 
        success: false, 
        message: error.message 
      });
    }
    res.status(400).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * PATCH /api/admin/bets/:id/cancel - Cancel bet (admin only)
 */
const adminCancelBet = async (req, res) => {
  try {
    checkAdmin(req);

    const { id } = req.params;

    const cancelledBet = await betService.cancelBet(id, req.user.id);

    res.json({
      success: true,
      message: 'Bet cancelled successfully',
      data: cancelledBet
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ 
        success: false, 
        message: error.message 
      });
    }
    res.status(400).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * GET /api/admin/bets/pending - Get pending bets (admin only)
 */
const adminGetPendingBets = async (req, res) => {
  try {
    checkAdmin(req);

    const pendingBets = await betService.getPendingBets();

    res.json({
      success: true,
      data: pendingBets
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ 
        success: false, 
        message: error.message 
      });
    }
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * GET /api/admin/stats - Get betting statistics (admin only)
 */
const adminGetStats = async (req, res) => {
  try {
    checkAdmin(req);

    const { Bet, sequelize } = require('../../models');

    const stats = await Bet.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('Bet.id')), 'totalBets'],
        [sequelize.fn('SUM', sequelize.col('stake')), 'totalStake'],
        [sequelize.fn('SUM', sequelize.col('potentialReturn')), 'totalPotentialReturn'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN result = 'WON' THEN potentialReturn ELSE 0 END")), 'totalPaidOut'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'OPEN' THEN 1 END")), 'pendingBets'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN result = 'WON' THEN 1 END")), 'wonBets'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN result = 'LOST' THEN 1 END")), 'lostBets']
      ],
      raw: true
    });

    res.json({
      success: true,
      data: stats[0] || {
        totalBets: 0,
        totalStake: 0,
        totalPotentialReturn: 0,
        totalPaidOut: 0,
        pendingBets: 0,
        wonBets: 0,
        lostBets: 0
      }
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ 
        success: false, 
        message: error.message 
      });
    }
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// ============ EXPORT ============
module.exports = {
  // User routes
  getUserBets,
  getBetById,
  placeBet,
  getBetsByBookingCode,
  getUserBetStats,
  
  // Admin routes
  adminGetAllBets,
  adminGetBetById,
  adminSettleBet,
  adminCancelBet,
  adminGetPendingBets,
  adminGetStats
};