const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const moneyController = require('../../controllers/financial/money.controller');
const snippeController = require('../../controllers/financial/snippe.controller');

// ============ PUBLIC WEBHOOKS ============
// Keep PalmPesa webhook for backward compatibility
router.post('/palmpesa-webhook', moneyController.palmPesaWebhook);
// Add Snippe webhook
router.post('/snippe-webhook', snippeController.snippeWebhook);

// ============ PROTECTED ROUTES ============

// ===== SNIPPE Routes =====
// Snippe Mobile Deposit
router.post('/deposit/snippe', authenticate, snippeController.depositViaSnippe);
router.get('/payment/status/snippe/:transactionId', authenticate, snippeController.checkSnippeStatus);

// Admin Withdrawal via Snippe
router.post('/admin/withdraw', authenticate, snippeController.adminWithdrawViaSnippe);

// ===== Original Routes (keep as is) =====
// Regular Deposit (Manual/Admin)
router.post('/deposit', authenticate, moneyController.depositMoney);

// Withdraw & Balance (keep original)
router.post('/withdraw', authenticate, moneyController.withdrawMoney);
router.get('/balance', authenticate, moneyController.checkBalance);

// Keep old PalmPesa routes for compatibility (can be deprecated)
router.post('/deposit/palmpesa', authenticate, moneyController.depositViaPalmPesa);
router.get('/payment/status/:transactionId', authenticate, moneyController.checkPalmPesaStatus);

module.exports = router;