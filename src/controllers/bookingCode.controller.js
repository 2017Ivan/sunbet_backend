const bookingCodeService = require('../services/bookingCode.service');
const {
  ValidationError,
  asyncHandler
} = require('../utils/errors');

/**
 * Create a new booking code
 * POST /api/booking-codes/create
 */
const createBookingCode = asyncHandler(async (req, res) => {
  const { selections } = req.body;

  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Selections are required'
    });
  }

  const result = await bookingCodeService.createBookingCode(selections);

  res.status(201).json({
    success: true,
    message: 'Booking code created successfully',
    data: {
      bookingCode: result.code,
      expiresAt: result.expiresAt,
      expiresInHours: 5
    }
  });
});

/**
 * Load booking code (get selections)
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

  res.json({
    success: true,
    message: 'Booking code loaded successfully',
    data: {
      selections: result.selections,
      expiresAt: result.expiresAt,
      createdAt: result.createdAt
    }
  });
});

/**
 * Check booking code status
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

module.exports = {
  createBookingCode,
  loadBookingCode,
  checkBookingCode
};