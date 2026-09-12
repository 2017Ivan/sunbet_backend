// routes/money/money.route.js
const express = require('express');
const router = express.Router();
const moneyController = require('../../controllers/money/money.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ============ PUBLIC (no auth) - webhooks ============
router.post('/palmpesa-webhook', moneyController.palmPesaWebhook);
// Snipe hutuma webhook kwa '/api/snippe-webhook' (ndio URL iliyosajiliwa kwenye
// dashboard ya Snippe). '/snipe-webhook' imebaki kwa ushirikiano wa zamani.
router.post('/snippe-webhook', moneyController.snipeWebhook);
router.post('/snipe-webhook', moneyController.snipeWebhook);
router.post('/anypay-webhook', moneyController.anyPayWebhook);

// ============ UNIFIED DEPOSIT (routes to active gateway: PalmPesa/Snipe/AnyPay) ============
router.post('/deposit', authenticate, moneyController.deposit);
router.get('/payment/status/:transactionId', authenticate, moneyController.checkDepositStatus);

// ============ PAYMENT GATEWAY SWITCH (admin) ============
router.get('/deposit/gateway', authenticate, moneyController.getPaymentGateway);
router.post('/deposit/gateway', authenticate, authorize(['ADMIN']), moneyController.setPaymentGateway);

// ============ PROVIDER API KEYS (admin, DB-backed) ============
router.get('/deposit/gateway/keys', authenticate, authorize(['ADMIN']), moneyController.getProviderKeys);
router.put('/deposit/gateway/keys', authenticate, authorize(['ADMIN']), moneyController.updateProviderKeys);
router.post('/deposit/gateway/keys', authenticate, authorize(['ADMIN']), moneyController.updateProviderKeys);

// ============ DEPOSIT (PalmPesa direct - backwards compatible) ============
router.post('/deposit/palmpesa', authenticate, moneyController.depositViaPalmPesa);

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