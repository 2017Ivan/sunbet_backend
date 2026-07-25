// routes/bookingcode/bookingCode.routes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const bookingCodeController = require('../../controllers/bookingcode/bookingCode.controller');

// ── Public routes (no authentication required) ─────────────────────────────
router.post('/create', bookingCodeController.createBookingCode);
router.get('/:code/load', bookingCodeController.loadBookingCode);
router.get('/:code/check', bookingCodeController.checkBookingCode);

// ── Protected routes (authentication required) ─────────────────────────────
router.use(authenticate);

router.get('/my', bookingCodeController.getUserBookingCodes);
router.get('/:id', bookingCodeController.getBookingCodeById);
router.patch('/:id/deactivate', bookingCodeController.deactivateBookingCode);

// ── Admin routes ─────────────────────────────────────────────────────────────
router.get('/admin/all', authorize(['ADMIN', 'AGENT']), bookingCodeController.getAllBookingCodes);
router.patch('/admin/:id/score', authorize(['ADMIN', 'AGENT']), bookingCodeController.updateSelectionScore);
router.patch('/admin/:id/deactivate', authorize(['ADMIN', 'AGENT']), bookingCodeController.deactivateBookingCode);

module.exports = router;