const express = require('express');
const router = express.Router();
const { authenticate,authorize } = require('../../middleware/auth.middleware');
const moneyController = require('../../controllers/financial/money.controller');

// ============ PUBLIC WEBHOOKS ============
router.post('/snippe-webhook', moneyController.snippeWebhook);

// ============ PROTECTED ROUTES ============

// Deposit (Snippe Mobile Money)
router.post('/deposit/snipe', authenticate, moneyController.deposit);

// Check payment status
router.get('/payment/status/:transactionId', authenticate, moneyController.checkPaymentStatus);

// Admin withdrawal via Snippe
router.post('/admin/withdraw', authenticate, authorize(['ADMIN']),moneyController.adminWithdraw);

// Withdraw & Balance (original)
router.post('/withdraw', authenticate, moneyController.withdraw);
router.get('/balance', authenticate, moneyController.balance);

module.exports = router;