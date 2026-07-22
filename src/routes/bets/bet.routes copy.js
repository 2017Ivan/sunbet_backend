// routes/bets/bet.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const betController = require('../../controllers/bet Management/bet.controller');

// ── All bet routes require authentication ──────────────────────────────────
router.use(authenticate);

// ── USER ROUTES (accessible by all authenticated users) ────────────────────
router.get('/bets', betController.getUserBets);           // User gets their own bets
router.get('/bets/:id', betController.getBetById);        // User gets their own bet by ID
router.post('/bets', betController.placeBet);      // User places a bet

// ── ADMIN ROUTES (role 'ADMIN' required) ──────────────────────────────────
// These routes will check role inside the controller
router.get('/admin/bets', betController.adminGetAllBets);        // Get all bets
router.get('/admin/bets/:id', betController.adminGetBetById);   // Get any bet with user details
router.patch('/admin/bets/:id/approve', betController.adminApproveBet); // Approve bet
router.delete('/admin/bets/:id', betController.adminDeleteBet); // Delete bet
router.get('/admin/stats', betController.adminGetStats);         // Get statistics

module.exports = router;