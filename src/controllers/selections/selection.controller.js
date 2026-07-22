// controllers/selections/selection.controller.js

const selectionService = require('../../services/selections/selection.service');
const bookingCodeService = require('../../services/bookingcode/bookingCode.service');

// ============ USER ROUTES ============

/**
 * GET /api/selections/booking-code/:bookingCodeId - Get selections by booking code
 */
const getSelectionsByBookingCode = async (req, res) => {
  try {
    const { bookingCodeId } = req.params;
    const userId = req.user.id;

    // Verify booking code belongs to user
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

    const selections = await selectionService.getSelectionsByBookingCode(bookingCodeId);

    res.json({
      success: true,
      data: selections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /api/selections/:id - Get selection by ID
 */
const getSelectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const selection = await selectionService.getSelectionById(id);

    if (!selection) {
      return res.status(404).json({
        success: false,
        message: 'Selection not found'
      });
    }

    // Check if user owns the booking code
    const bookingCode = await bookingCodeService.getBookingCodeById(selection.bookingCodeId);
    if (bookingCode.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    res.json({
      success: true,
      data: selection
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /api/selections/pending - Get pending selections (not settled)
 */
const getPendingSelections = async (req, res) => {
  try {
    const selections = await selectionService.getPendingSelections();

    res.json({
      success: true,
      data: selections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /api/selections/search - Search selections by match name
 * Query: ?q=team+name
 */
const searchSelections = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 2 characters'
      });
    }

    const selections = await selectionService.searchSelectionsByMatch(q);

    res.json({
      success: true,
      data: selections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============ ADMIN ROUTES ============

/**
 * CHECK ADMIN ROLE
 */
const checkAdmin = (req) => {
  if (req.user.role !== 'ADMIN') {
    throw new Error('Access denied. Admin role required.');
  }
};

/**
 * PATCH /api/admin/selections/:id/score - Update selection score
 * Body: { homeScore, awayScore }
 */
const adminUpdateScore = async (req, res) => {
  try {
    checkAdmin(req);

    const { id } = req.params;
    const { homeScore, awayScore } = req.body;

    if (homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Home score and away score are required'
      });
    }

    const selection = await selectionService.updateSelectionScore(id, homeScore, awayScore);

    res.json({
      success: true,
      message: 'Score updated successfully',
      data: selection
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
 * PATCH /api/admin/selections/:id/settle - Update score and auto-settle bets
 * Body: { homeScore, awayScore }
 */
const adminUpdateScoreAndSettle = async (req, res) => {
  try {
    checkAdmin(req);

    const { id } = req.params;
    const { homeScore, awayScore } = req.body;

    if (homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Home score and away score are required'
      });
    }

    const result = await selectionService.updateScoreAndSettle(id, homeScore, awayScore);

    res.json({
      success: true,
      message: `Score updated and bets settled with result: ${result.result}`,
      data: result
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
 * POST /api/admin/selections/bulk-update - Bulk update scores
 * Body: { selections: [{ id, homeScore, awayScore }] }
 */
const adminBulkUpdateScores = async (req, res) => {
  try {
    checkAdmin(req);

    const { selections } = req.body;

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one selection score update is required'
      });
    }

    const result = await selectionService.bulkUpdateScores(selections);

    res.json({
      success: true,
      message: `Updated ${result.totalUpdated} selections, ${result.totalErrors} errors`,
      data: result
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
 * GET /api/admin/selections - Get all selections with filters
 * Query: ?result=PENDING&limit=100&offset=0
 */
const adminGetSelections = async (req, res) => {
  try {
    checkAdmin(req);

    const { result, limit = 100, offset = 0 } = req.query;

    let selections;
    if (result) {
      selections = await selectionService.getSelectionsByResult(result, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } else {
      // Get all selections (with pagination)
      const { Selection } = require('../../models');
      selections = await Selection.findAndCountAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });
    }

    res.json({
      success: true,
      data: selections
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
 * PATCH /api/admin/selections/:id/result - Manually settle selection
 * Body: { result: 'WON' | 'LOST' }
 */
const adminSettleSelection = async (req, res) => {
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

    const settlementResult = await selectionService.settleSelection(id, result);

    res.json({
      success: true,
      message: `Selection settled as ${result}`,
      data: settlementResult
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
 * GET /api/admin/selections/stats/:bookingCodeId - Get selection statistics
 */
const adminGetSelectionStats = async (req, res) => {
  try {
    checkAdmin(req);

    const { bookingCodeId } = req.params;

    const stats = await selectionService.getSelectionStats(bookingCodeId);

    res.json({
      success: true,
      data: stats
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
  getSelectionsByBookingCode,
  getSelectionById,
  getPendingSelections,
  searchSelections,

  // Admin routes
  adminUpdateScore,
  adminUpdateScoreAndSettle,
  adminBulkUpdateScores,
  adminGetSelections,
  adminSettleSelection,
  adminGetSelectionStats
};