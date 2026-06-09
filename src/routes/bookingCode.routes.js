const express = require('express');
const router = express.Router();
const {
  createBookingCode,
  loadBookingCode,
  checkBookingCode
} = require('../controllers/bookingCode.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Public routes (no authentication required)
router.get('/:code/load', loadBookingCode);
router.get('/:code/check', checkBookingCode);

// Protected routes (authentication required)
// router.post('/create', authenticate, createBookingCode);
router.post('/create',  createBookingCode);

module.exports = router;