src/routes/financial/money.routes.js// routes/financial/money.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const moneyController = require('../../controllers/financial/money.controller');

// ============ PUBLIC WEBHOOK ============
router.post('/palmpesa-webhook', moneyController.palmPesaWebhook);

// ============ PROTECTED ROUTES ============

// PalmPesa Mobile Deposit
router.post('/deposit/palmpesa', authenticate, moneyController.depositViaPalmPesa);
router.get('/payment/status/:transactionId', authenticate, moneyController.checkPalmPesaStatus);

// Regular Deposit (Manual/Admin)
router.post('/deposit', authenticate, moneyController.depositMoney);

// Withdraw & Balance
router.post('/withdraw', authenticate, moneyController.withdrawMoney);
router.get('/balance', authenticate, moneyController.checkBalance);

module.exports = router;