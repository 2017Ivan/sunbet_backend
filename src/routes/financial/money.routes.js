// moneyController.routes.js 
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const moneyController = require('../../controllers/financial/money.controller');

// Public webhook
router.post('/mongike-webhook', moneyController.mongikeWebhook);

// Protected
router.post('/deposit', authenticate, moneyController.depositMoney);
router.get('/payment/:reference', authenticate, moneyController.checkPaymentStatus);
router.post('/payment/manual-confirm', authenticate, moneyController.manualConfirmDeposit);
router.get('/payments/pending', authenticate, moneyController.checkPendingPayments);
router.post('/withdraw', authenticate, moneyController.withdrawMoney);
router.get('/balance', authenticate, moneyController.checkBalance);

module.exports = router;