// controllers/bet Management/bet.controller.js
const betRepository = require('../../repositories/bet.repository');
const betService = require('../../services/bets/bet.service')

// ============ USER ROUTES ============

/**
 * GET /api/bets - Get user's own bets
 */
const getUserBets = async (req, res) => {

  console.log("getAll bets called: ")
  try {
    const userId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    const where = { userId };
    if (status) where.status = status;

    const bets = await betRepository.findAll(where, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const formattedBets = bets.rows.map(bet => {
      const betData = bet.toJSON();
      try {
        betData.selections = JSON.parse(betData.selections);
      } catch (e) {
        betData.selections = [];
      }
      return betData;
    });

    res.json({
      success: true,
      data: {
        total: bets.count,
        bets: formattedBets,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < bets.count
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      return res.status(404).json({ message: 'Bet not found' });
    }

    if (bet.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const betData = bet.toJSON();
    try {
      betData.selections = JSON.parse(betData.selections);
    } catch (e) {
      betData.selections = [];
    }

    res.json({ success: true, data: betData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/bets/place - Place a bet
 */
// controllers/bet Management/bet.controller.js

const placeBet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { selections, stake } = req.body;

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ message: 'At least one selection is required' });
    }

    if (!stake || stake < 100) {
      return res.status(400).json({ message: 'Minimum stake is 100 TZS' });
    }

    // REKEBISHO: Pitisha selections na stake zikiwa zimetengana, sio ndani ya {}
    const bet = await betService.placeBet(userId, selections, stake);

    res.status(201).json({
      success: true,
      message: 'Bet placed successfully',
      data: bet
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
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

    const { status, result, limit = 100, offset = 0 } = req.query;

    let where = {};
    if (status) where.status = status;
    if (result) where.result = result;

    const bets = await betRepository.findAll(where, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const formattedBets = bets.rows.map(bet => {
      const betData = bet.toJSON();
      try {
        betData.selections = JSON.parse(betData.selections);
      } catch (e) {
        betData.selections = [];
      }
      return betData;
    });

    res.json({
      success: true,
      data: {
        total: bets.count,
        bets: formattedBets,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < bets.count
        }
      }
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/admin/bets/:id - Get single bet with user details (admin only)
 */
const adminGetBetById = async (req, res) => {
  try {
    checkAdmin(req);

    const bet = await betRepository.getBetWithUser(req.params.id);

    if (!bet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    const betData = bet.toJSON();
    betData.selections = JSON.parse(betData.selections);

    res.json({ success: true, data: betData });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/admin/bets/:id/approve - Approve bet (admin only)
 */
const adminApproveBet = async (req, res) => {
  try {
    checkAdmin(req);

    const { id } = req.params;
    const { result } = req.body;

    if (!['WON', 'LOST'].includes(result)) {
      return res.status(400).json({ message: 'Result must be WON or LOST' });
    }

    const updatedBet = await betService.approveBet(id, result);

    res.json({
      success: true,
      message: `Bet approved as ${result}`,
      data: updatedBet
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /api/admin/bets/:id - Delete bet (admin only)
 */
const adminDeleteBet = async (req, res) => {
  try {
    checkAdmin(req);

    const bet = await betRepository.findById(req.params.id);

    if (!bet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    await bet.destroy();

    res.json({
      success: true,
      message: 'Bet deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Access denied. Admin role required.') {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/admin/stats - Get betting statistics (admin only)
 */
const adminGetStats = async (req, res) => {
  try {
    checkAdmin(req);

    const { Bet, sequelize } = require('../models');

    const stats = await Bet.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalBets'],
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
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

// ============ EXPORT ============
module.exports = {
  // User routes
  getUserBets,
  getBetById,
  placeBet,
  
  // Admin routes
  adminGetAllBets,
  adminGetBetById,
  adminApproveBet,
  adminDeleteBet,
  adminGetStats
};