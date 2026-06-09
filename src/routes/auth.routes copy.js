// routes/auth.routes.js - SAHIHISHA HII
const express = require('express');
const router = express.Router();
const userController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware'); // ADD THIS
const { isAdminByPhone } = require('../middleware/admin.middleware');
// Public routes (hazihitaji token)
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/refresh', userController.refreshToken);
router.post('/webhook', userController.mongikeWebhook);
router.post('/forgot-password', userController.forgotPassword);           // Step 1: Request reset
router.post('/reset-password', userController.resetPassword);             // Step 2: Reset with userId
router.post('/change-password', userController.changePasswordByPhone);    // Alternative: One step reset
//  all routes below need token
router.use(authenticate);

// Protected routes (zinahitaji token)
router.post('/deposit', userController.depositMoney);
router.post('/withdraw', userController.withdrawMoney);
// router.post('/withdrawAdmin', userController.AdminWithdrawMoney);
router.get('/balance', userController.checkBalance);
router.post('/confirm-deposit', userController.confirmDeposit);
// Add these after router.use(authenticate)
router.get('/pending-payments', userController.checkPendingPayments);
router.post('/manual-deposit', userController.manualConfirmDeposit);
router.get('/profile', userController.getProfile);
router.get('/payment-status/:order_id', userController.checkPaymentStatus);
// Add to your routes
router.get('/check-admin', authenticate, userController.checkAdminStatus);

// ADMIN ONLY route - requires both authentication AND admin privileges
// router.post('/withdrawAdmin', isAdminByPhone, userController.AdminWithdrawMoney);
router.post('/withdrawAdmin', isAdminByPhone, userController.AdminWithdrawMoneyDb);


module.exports = router;