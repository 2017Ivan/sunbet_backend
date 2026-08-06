// routes/bets/bet.routes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const betController = require('../../controllers/bets/bet.controller');

// ── All bet routes require authentication ──────────────────────────────────
router.use(authenticate);

// ── USER ROUTES ────────────────────────────────────────────────────────────
router.get('/', betController.getUserBets);
router.get('/:id', betController.getBetById);
router.post('/place', betController.placeBet);  
router.get('/booking-code/:bookingCodeId', betController.getBetsByBookingCode);
router.get('/stats/my', betController.getUserBetStats);

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────
router.use('/admin', authorize(['ADMIN', 'AGENT']));

router.get('/admin/bets', betController.adminGetAllBets);
router.get('/admin/bets/:id', betController.adminGetBetById);
router.patch('/admin/bets/:id/settle', betController.adminSettleBet);
router.patch('/admin/bets/:id/cancel', betController.adminCancelBet);
router.get('/admin/bets/pending', betController.adminGetPendingBets);
router.get('/admin/stats', betController.adminGetStats);

module.exports = router;