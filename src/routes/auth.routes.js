const express = require('express');
const router = express.Router();
const userController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdminByPhone } = require('../middleware/admin.middleware');

// ============ PUBLIC ROUTES ============
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/refresh', userController.refreshToken);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.post('/change-password', userController.changePasswordByPhone);
router.post('/mongike-webhook', userController.mongikeWebhook);

// ============ PROTECTED ROUTES ============
router.use(authenticate);

router.get('/profile', userController.getProfile);
router.get('/balance', userController.checkBalance);
router.post('/deposit', userController.depositMoney);
router.post('/withdraw', userController.withdrawMoney);
router.post('/manual-deposit', userController.manualConfirmDeposit);
router.get('/payment/status/:reference', userController.checkPaymentStatus);
router.get('/pending-payments', userController.checkPendingPayments);
router.get('/check-admin', userController.checkAdminStatus);

// ============ ADMIN ROUTES ============
router.post('/withdrawAdmin', isAdminByPhone, userController.AdminWithdrawMoneyDb);
router.get('/admin/users', isAdminByPhone, userController.adminGetAllUsers);
router.get('/admin/user/:phone_number', isAdminByPhone, userController.adminGetUserByPhone);
router.put('/admin/user/:phone_number/balance', isAdminByPhone, userController.adminSetBalanceByPhone);
router.post('/admin/user/:phone_number/add-balance', isAdminByPhone, userController.adminAddBalanceByPhone);
router.post('/admin/user/:phone_number/deduct-balance', isAdminByPhone, userController.adminDeductBalanceByPhone);
router.delete('/admin/user/:phone_number', isAdminByPhone, userController.adminDeleteUserByPhone);

module.exports = router;