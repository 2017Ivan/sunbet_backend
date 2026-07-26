// controllers/bookingcode/bookingCode.controller.js

const bookingCodeService = require('../../services/bookingcode/bookingCode.service');
const {
  ValidationError,
  asyncHandler
} = require('../../utils/errors');

/**
 * Create a new booking code (PUBLIC - no login required)
 * POST /api/booking-codes/create
 * Body: { selections: [{ matchId, matchName, selectionType, selectionValue, odds, time, date, league, marketType }] }
 */
const createBookingCode = asyncHandler(async (req, res) => {
  const { selections } = req.body;

  console.log('📥 Controller received selections:', JSON.stringify(selections, null, 2));

  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Selections are required'
    });
  }

  const result = await bookingCodeService.createBookingCode(null, selections);

  res.status(201).json({
    success: true,
    message: 'Booking code created successfully',
    data: {
      bookingCode: result.bookingCode,
      selections: result.selections,
      totalSelections: result.totalSelections
    }
  });
});

/**
 * Load booking code (get selections) - PUBLIC
 * GET /api/booking-codes/:code/load
 */
const loadBookingCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Booking code is required'
    });
  }

  const result = await bookingCodeService.loadBookingCode(code);

  const selections = result.selections || [];
  const totalSelections = Array.isArray(selections) ? selections.length : 0;

  res.json({
    success: true,
    message: 'Booking code loaded successfully',
    data: {
      bookingCode: result.bookingCode,
      selections: selections,
      totalSelections: totalSelections
    }
  });
});

/**
 * Check booking code status - PUBLIC
 * GET /api/booking-codes/:code/check
 */
const checkBookingCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Booking code is required'
    });
  }

  const result = await bookingCodeService.checkBookingCode(code);

  res.json({
    success: true,
    data: result
  });
});

/**
 * Get user's booking codes (AUTHENTICATED)
 * GET /api/booking-codes/my
 */
const getUserBookingCodes = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const bookingCodes = await bookingCodeService.getUserBookingCodes(userId);

  res.json({
    success: true,
    data: bookingCodes
  });
});

/**
 * Get all booking codes (ADMIN only)
 * GET /api/booking-codes/admin/all
 */
const getAllBookingCodes = asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0, status } = req.query;

  const result = await bookingCodeService.getAllBookingCodes({
    limit: parseInt(limit),
    offset: parseInt(offset),
    status
  });

  res.json({
    success: true,
    data: {
      total: result.count,
      bookingCodes: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < result.count
      }
    }
  });
});

/**
 * Get booking code by ID (AUTHENTICATED)
 * GET /api/booking-codes/:id
 */
const getBookingCodeById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const bookingCode = await bookingCodeService.getBookingCodeById(id);

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

  res.json({
    success: true,
    data: bookingCode
  });
});

/**
 * Update selection score (ADMIN only)
 * PATCH /api/booking-codes/:id/score
 * Body: { matchId, homeScore, awayScore, selectionType, marketType }
 */
const updateSelectionScore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { matchId, homeScore, awayScore, selectionType, marketType } = req.body;

  console.log('📥 Update score request:');
  console.log('📥 bookingCodeId:', id);
  console.log('📥 matchId:', matchId);
  console.log('📥 homeScore:', homeScore);
  console.log('📥 awayScore:', awayScore);
  console.log('📥 selectionType:', selectionType);
  console.log('📥 marketType:', marketType);

  // Validate required fields
  if (!matchId) {
    return res.status(400).json({
      success: false,
      message: 'Match ID is required'
    });
  }

  if (homeScore === undefined || awayScore === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Home score and away score are required'
    });
  }

  if (!selectionType) {
    return res.status(400).json({
      success: false,
      message: 'Selection type is required'
    });
  }

  if (!['HOME', 'DRAW', 'AWAY', 'OVER', 'UNDER', 'YES', 'NO'].includes(selectionType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid selection type. Must be HOME, DRAW, AWAY, OVER, UNDER, YES, or NO'
    });
  }

  if (!marketType) {
    return res.status(400).json({
      success: false,
      message: 'Market type is required'
    });
  }

  const bookingCode = await bookingCodeService.updateSelectionScore(
    id,
    matchId,
    parseInt(homeScore),
    parseInt(awayScore),
    selectionType,
    marketType
  );

  res.json({
    success: true,
    message: 'Score updated successfully',
    data: bookingCode
  });
});

/**
 * Deactivate booking code (AUTHENTICATED)
 * PATCH /api/booking-codes/:id/deactivate
 */
const deactivateBookingCode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const bookingCode = await bookingCodeService.getBookingCodeById(id);

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

  const result = await bookingCodeService.deactivateBookingCode(id);

  res.json({
    success: true,
    message: 'Booking code deactivated successfully',
    data: result
  });
});

module.exports = {
  createBookingCode,
  loadBookingCode,
  checkBookingCode,
  getUserBookingCodes,
  getAllBookingCodes,
  getBookingCodeById,
  updateSelectionScore,
  deactivateBookingCode
};