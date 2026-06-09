// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { isAdminByPhone } = require('../middleware/admin.middleware');
const betRepository = require('../repositories/bet.repository');
const betService = require('../services/bet.service');
const userController = require('../controllers/auth.controller');

// Apply both authentication and admin middleware
router.use(authenticate);
router.use(isAdminByPhone);

/**
 * GET /api/admin/bets - Get all bets (all users)
 */
router.get('/bets', async (req, res) => {
  try {
    const { status, result, limit = 100, offset = 0 } = req.query;
    
    // Build where clause
    let where = {};
    if (status) where.status = status;
    if (result) where.result = result;
    
    const bets = await betRepository.findAll(where, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });
    
    // Parse selections for each bet
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
    console.error('Error fetching all bets:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/bets/:id - Get single bet with user details
 */
router.get('/bets/:id', async (req, res) => {
  try {
    const bet = await betRepository.getBetWithUser(req.params.id);
    
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found' });
    }
    
    const betData = bet.toJSON();
    betData.selections = JSON.parse(betData.selections);
    
    res.json({
      success: true,
      data: betData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PATCH /api/admin/bets/:id/approve - Approve bet (WON/LOST)
 */
router.patch('/bets/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { result } = req.body; // WON or LOST
    
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
    console.error('Error approving bet:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * DELETE /api/admin/bets/:id - Delete bet
 */
router.delete('/bets/:id', async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/stats - Get overall betting statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { Bet, User, sequelize } = require('../models');
    
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
    res.status(500).json({ message: error.message });
  }
});


/**
 * USER MANAGEMENT ROUTES
 */

// ============ GET ALL USERS ============
router.get('/users', userController.adminGetAllUsers);

// ============ GET USER BY PHONE NUMBER ============
router.get('/users/phone/:phone_number', userController.adminGetUserByPhone);

// ============ SET EXACT BALANCE BY PHONE ============
router.put('/users/phone/:phone_number/balance', userController.adminSetBalanceByPhone);

// ============ ADD BALANCE BY PHONE ============
router.post('/users/phone/:phone_number/balance/add', userController.adminAddBalanceByPhone);

// ============ DEDUCT BALANCE BY PHONE ============
router.post('/users/phone/:phone_number/balance/deduct', userController.adminDeductBalanceByPhone);

// ============ DELETE USER BY PHONE ============
router.delete('/users/phone/:phone_number', userController.adminDeleteUserByPhone);

module.exports = router;