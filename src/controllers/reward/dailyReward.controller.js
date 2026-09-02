// controllers/reward/dailyReward.controller.js
const dailyRewardService = require('../../services/reward/dailyReward.service');

// Daily/login reward imezimwa (hakuna bonus ya daily wala login)
const getDailyRewardStatus = async (req, res, next) => {
  try {
    return res.status(200).json({
      status: 200,
      message: 'Daily reward is disabled',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

const claimDailyReward = async (req, res, next) => {
  try {
    return res.status(200).json({
      status: 200,
      message: 'Daily reward is disabled',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDailyRewardStatus,
  claimDailyReward
};