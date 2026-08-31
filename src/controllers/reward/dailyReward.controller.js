// controllers/reward/dailyReward.controller.js
const dailyRewardService = require('../../services/reward/dailyReward.service');

const getDailyRewardStatus = async (req, res, next) => {
  try {
    const result = await dailyRewardService.getDailyRewardStatus(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const claimDailyReward = async (req, res, next) => {
  try {
    const result = await dailyRewardService.claimDailyReward(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDailyRewardStatus,
  claimDailyReward
};