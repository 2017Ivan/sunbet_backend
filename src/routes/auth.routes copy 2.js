// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdminByPhone } = require('../middleware/admin.middleware');

// Public routes (hazihitaji token)
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/refresh', userController.refreshToken);
router.post('/webhook', userController.mongikeWebhook);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.post('/change-password', userController.changePasswordByPhone);

//  WEBHOOK ROUTE MUST BE PUBLIC (NO AUTH)
// Mongike inaita hii baada ya malipo kukamilika
router.post('/mongike-webhook', userController.mongikeWebhook);  // ← ADD THIS!

// All routes below need token
router.use(authenticate);

// Protected routes (zinahitaji token)
router.post('/deposit', userController.depositMoney);
router.post('/withdraw', userController.withdrawMoney);
router.get('/balance', userController.checkBalance);
router.post('/confirm-deposit', userController.confirmDeposit);
router.get('/pending-payments', userController.checkPendingPayments);
router.post('/manual-deposit', userController.manualConfirmDeposit);
router.get('/profile', userController.getProfile);

//  FIX THIS - Change parameter name to match controller
// Controller inatumia 'reference' so route lazima itumie 'reference'
router.get('/payment/status/:reference', userController.checkPaymentStatus);  // ← CHANGE THIS

// Or if you want to keep 'order_id', change controller
// router.get('/payment-status/:order_id', userController.checkPaymentStatus);

router.get('/check-admin', userController.checkAdminStatus);

// ADMIN ONLY routes
router.post('/withdrawAdmin', isAdminByPhone, userController.AdminWithdrawMoneyDb);

module.exports = router;