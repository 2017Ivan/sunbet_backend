// routes/selections/selection.routes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const selectionController = require('../../controllers/selections/selection.controller');

// ── All selection routes require authentication ─────────────────────────────
router.use(authenticate);

// ── USER ROUTES ──────────────────────────────────────────────────────────────
router.get('/booking-code/:bookingCodeId', selectionController.getSelectionsByBookingCode); // GET /api/selections/booking-code/:bookingCodeId
router.get('/:id', selectionController.getSelectionById);               // GET /api/selections/:id
router.get('/pending/list', selectionController.getPendingSelections);  // GET /api/selections/pending/list
router.get('/search/query', selectionController.searchSelections);      // GET /api/selections/search/query?q=team

// ── ADMIN ROUTES (role 'ADMIN' required) ──────────────────────────────────
router.use('/admin', authorize('ADMIN'));

router.patch('/admin/:id/score', selectionController.adminUpdateScore);              // PATCH /api/selections/admin/:id/score
router.patch('/admin/:id/settle', selectionController.adminUpdateScoreAndSettle);    // PATCH /api/selections/admin/:id/settle
router.post('/admin/bulk-update', selectionController.adminBulkUpdateScores);        // POST /api/selections/admin/bulk-update
router.get('/admin/list', selectionController.adminGetSelections);                   // GET /api/selections/admin/list
router.patch('/admin/:id/result', selectionController.adminSettleSelection);         // PATCH /api/selections/admin/:id/result
router.get('/admin/stats/:bookingCodeId', selectionController.adminGetSelectionStats); // GET /api/selections/admin/stats/:bookingCodeId

module.exports = router;