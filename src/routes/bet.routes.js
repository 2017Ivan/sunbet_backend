// routes/bet.routes.js
const express = require('express');
const router = express.Router();
const {
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
  approveBetController,
  getUncheckedWins
} = require('../controllers/bet.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Bet placement
router.post('/', placeBet);

// User bets
router.get('/user', getUserBets);
router.get('/stats', getUserBetStats);

// Booking code endpoints (order matters - specific before generic)
router.get('/check/:bookingCode', checkBookingCodeStatus);
router.get('/preview/:bookingCode', previewBookingCode);
router.get('/active/:bookingCode', loadActiveBetByCode);
router.get('/load/:bookingCode', loadBetByBookingCode);
router.get('/unchecked-wins', getUncheckedWins);

// Bet management
router.get('/:betId', getBetById);
router.post('/:betId/generate-booking-code', generateBookingCode);
router.patch('/:betId/cancel', cancelBet);
router.patch('/:betId/settle', settleBet);
router.patch('/:id/approve', approveBetController);

module.exports = router;