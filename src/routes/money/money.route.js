// routes/money/money.route.js
const express = require('express');
const router = express.Router();
const moneyController = require('../../controllers/money/money.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Authenticated - user id inatolewa kwenye token (req.user.id)
// Wote (customer + admin) wanatumia route moja
router.post('/deposite', authenticate, moneyController.deposite);
router.post('/withdraw', authenticate, moneyController.withdraw);

module.exports = router;
