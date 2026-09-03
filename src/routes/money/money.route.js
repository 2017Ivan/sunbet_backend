// routes/money/money.route.js
const express = require('express');
const router = express.Router();
const moneyController = require('../../controllers/money/money.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ============ PUBLIC (no auth) - PalmPesa webhook ============
router.post('/palmpesa-webhook', moneyController.palmPesaWebhook);

// ============ DEPOSIT (PalmPesa) ============
router.post('/deposit/palmpesa', authenticate, moneyController.depositViaPalmPesa);
router.get('/payment/status/:transactionId', authenticate, moneyController.checkPalmPesaStatus);

// ============ WITHDRAW ============
router.post('/withdraw', authenticate, moneyController.withdraw);
router.get('/withdraw/my', authenticate, moneyController.getMyWithdrawRequests);

// ============ ADMIN - WITHDRAW REQUESTS ============
router.get('/withdraw/requests', authenticate, authorize(['ADMIN']), moneyController.getAllWithdrawRequests);
router.post('/withdraw/confirm', authenticate, authorize(['ADMIN']), moneyController.confirmWithdraw);
router.post('/withdraw/cancel', authenticate, authorize(['ADMIN']), moneyController.cancelWithdraw);

// ============ BALANCE ============
router.get('/balance', authenticate, moneyController.balance);

module.exports = router;
