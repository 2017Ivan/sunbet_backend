// routes/bet.routes.js
const express = require('express');
const router = express.Router();
const {
  placeBet,
  loadBetByBookingCode,
  settleBet,
  getUserBets,
  generateBookingCode,
  getBetById,
  cancelBet,
  getUserBetStats
} = require('../controllers/bet.controller');
const { validateBetPlacement, validateSettleBet } = require('../middleware/auth.middleware');

// All routes require authentication

router.post('/', validateBetPlacement, placeBet);
router.get('/user', getUserBets);
router.get('/stats', getUserBetStats);
router.get('/load/:bookingCode', loadBetByBookingCode);
router.get('/:betId', getBetById);
router.post('/:betId/generate-booking-code', generateBookingCode);
router.patch('/:betId/cancel', cancelBet);
router.patch('/:betId/settle',  validateSettleBet, settleBet);

module.exports = router;