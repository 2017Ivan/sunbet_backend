// routes/adminBet.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { isAdminByPhone } = require('../middleware/admin.middleware');
const adminBetController = require('../controllers/adminBet.controller');
const userController = require('../controllers/auth.controller');

router.use(authenticate);
router.use(isAdminByPhone);


router.get('/stats', adminBetController.getStatistics);
router.get('/stats', adminBetController.getStatistics);
// ============ USER MANAGEMENT ROUTES (SPECIFIC) ============
router.get('/users', userController.adminGetAllUsers);
router.get('/users/phone/:phone_number', userController.adminGetUserByPhone);
router.put('/users/phone/:phone_number/balance', userController.adminSetBalanceByPhone);
router.post('/users/phone/:phone_number/balance/add', userController.adminAddBalanceByPhone);
router.post('/users/phone/:phone_number/balance/deduct', userController.adminDeductBalanceByPhone);
router.delete('/users/phone/:phone_number', userController.adminDeleteUserByPhone)

// Remove /adminBets prefix since it's already in the base path
router.get('/', adminBetController.getAllBets);  // Changed from /adminBets
router.get('/:id', adminBetController.getBetDetails);  // Changed from /adminBets/:id
router.put('/:id/selections', adminBetController.updateBetSelections);  // Changed from /adminBets/:id/selections
router.patch('/:id/approve', adminBetController.approveBet);
router.delete('/:id', adminBetController.deleteBet);



module.exports = router;