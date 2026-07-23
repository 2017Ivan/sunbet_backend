// routes/financial/money.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const moneyController = require('../../controllers/financial/money.controller');

// Deposit
router.post('/deposit', authenticate, moneyController.depositMoney);

// Withdraw
router.post('/withdraw', authenticate, moneyController.withdrawMoney);

// Balance
router.get('/balance', authenticate, moneyController.checkBalance);

module.exports = router;