// routes/bet.routes.js
const express = require('express');
const router = express.Router();
const {
  placeBet,
  loadBetByBookingCode,
  loadActiveBetByCode,
  settleBet,
  getUserBets,
  generateBookingCode,
  getBetById,
  cancelBet,
  getUserBetStats,
  approveBetController
} = require('../controllers/bet.controller');
const { authenticate } = require('../middleware/auth.middleware'); // Only import authenticate
// Don't import validateBetPlacement yet

// All routes require authentication
router.use(authenticate);

router.post('/', placeBet); // Remove validation temporarily
router.get('/user', getUserBets);
router.get('/stats', getUserBetStats);
router.get('/load/:bookingCode', loadBetByBookingCode);
router.get('/active/:bookingCode', loadActiveBetByCode);
router.get('/:betId', getBetById);
router.post('/:betId/generate-booking-code', generateBookingCode);
router.patch('/:betId/cancel', cancelBet);
router.patch('/:betId/settle', settleBet); // Remove validation temporarily
router.patch('/:id/approve', approveBetController);

module.exports = router;