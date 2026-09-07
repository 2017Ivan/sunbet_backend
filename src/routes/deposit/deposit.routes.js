// routes/deposit/deposit.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const depositController = require('../../controllers/deposit/deposit.controller');

// ============ RECIPIENTS MANAGEMENT (MY WITO WA DEPOSIT) ============
router.get('/recipients', authenticate, authorize(['ADMIN']), depositController.getRecipients);
router.post('/recipients', authenticate, authorize(['ADMIN']), depositController.addRecipient);
router.delete('/recipients/:id', authenticate, authorize(['ADMIN']), depositController.removeRecipient);

// ============ CUSTOMER ============
router.post('/request', authenticate, depositController.requestDeposit);
router.get('/my', authenticate, depositController.getMyRequests);

// ============ ADMIN (READ-ONLY - no accept/cancel for deposits) ============
router.get('/requests', authenticate, authorize(['ADMIN']), depositController.getAllRequests);

module.exports = router;