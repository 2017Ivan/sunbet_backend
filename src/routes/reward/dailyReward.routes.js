// routes/reward/dailyReward.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const dailyRewardController = require('../../controllers/reward/dailyReward.controller');

// Hali ya zawadi ya kila siku (inajitokeza baada ya kuingia)
router.get('/daily-reward/status', authenticate, dailyRewardController.getDailyRewardStatus);

// Kusanya (kuclaim) zawadi ya leo
router.post('/daily-reward/claim', authenticate, dailyRewardController.claimDailyReward);

module.exports = router;