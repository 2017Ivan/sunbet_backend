// services/reward/dailyReward.service.js

const userRepository = require('../../repositories/user/user.repository');
const transactionRepository = require('../../repositories/transaction/transaction.repository');
const CustomExceptions = require('../../middleware/CustomExceptions');
const responseBuilder = require('../../utils/response.builder');

// ============ REWARD TIERS (7-day cycle) ============
const REWARD_TIERS = {
  1: 1000,
  2: 2000,
  3: 3000,
  4: 5000,
  5: 7000,
  6: 10000,
  7: 15000
};

const toDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const todayString = () => toDateString(new Date());

const addDaysString = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const tierForDay = (dayNumber) => REWARD_TIERS[dayNumber] || REWARD_TIERS[1];

// Hali ya sasa ya streak (inahesabu iwapo leo anaweza kudai au tayari amedai)
const computeDailyRewardStatus = (user) => {
  const today = todayString();
  const lastClaim = toDateString(user.last_daily_claim);
  const currentStreak = parseInt(user.daily_streak || 0, 10);

  const alreadyClaimedToday = lastClaim === today;

  let canClaim = false;
  let nextStreak;
  let nextDay;
  let nextReward;
  let continuesStreak;

  if (alreadyClaimedToday) {
    // Kesho ndio atadai tena; streak itazidi
    nextStreak = currentStreak + 1;
    continuesStreak = true;
    nextReward = tierForDay(((nextStreak - 1) % 7) + 1);
  } else if (lastClaim === addDaysString(today, -1)) {
    // Alidai jana => streak inaendelea leo
    canClaim = true;
    nextStreak = currentStreak + 1;
    continuesStreak = true;
    nextReward = tierForDay(((nextStreak - 1) % 7) + 1);
  } else {
    // Amekosa siku => streak hapo ndiyo inaanza upya
    canClaim = true;
    nextStreak = currentStreak > 0 ? 1 : 1;
    continuesStreak = false;
    nextReward = tierForDay(1);
  }

  nextDay = ((nextStreak - 1) % 7) + 1;

  return {
    today,
    last_claim_date: lastClaim,
    current_streak: currentStreak,
    can_claim: canClaim,
    claimed_today: alreadyClaimedToday,
    continues_streak: continuesStreak,
    next_streak: nextStreak,
    next_day: nextDay,
    next_reward: nextReward,
    tiers: REWARD_TIERS
  };
};

const getDailyRewardStatus = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new CustomExceptions('User not found', 404);
  }
  return responseBuilder.success({
    status: 200,
    message: 'Daily reward status',
    data: {
      ...computeDailyRewardStatus(user),
      total_daily_rewards: user.total_daily_rewards,
      balance: user.balance
    }
  });
};

const claimDailyReward = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new CustomExceptions('User not found', 404);
  }

  const status = computeDailyRewardStatus(user);
  if (!status.can_claim) {
    throw new CustomExceptions('Umeshakusanya zawadi ya leo - rudi kesho!', 400);
  }

  const today = status.today;
  const rewardAmount = status.next_reward;
  const newStreak = status.next_streak;
  const claimDay = status.next_day;

  const balanceBefore = parseFloat(user.balance) || 0;
  const newBalance = parseFloat((balanceBefore + rewardAmount).toFixed(2));
  const newTotalRewards = parseFloat((parseFloat(user.total_daily_rewards || 0) + rewardAmount).toFixed(2));

  await user.update({
    daily_streak: newStreak,
    last_daily_claim: today,
    total_daily_rewards: newTotalRewards,
    balance: newBalance
  });

  // Rekodi transaction ya REWARD
  try {
    await transactionRepository.createTransaction({
      reference: `DWR-${Math.floor(10000000 + Math.random() * 90000000)}`,
      user_id: userId,
      type: 'REWARD',
      amount: rewardAmount,
      balance_before: balanceBefore,
      balance_after: newBalance,
      status: 'SUCCESS',
      description: `Daily login reward - Day ${claimDay} (${newStreak}-day streak)`
    });
  } catch (txnError) {
    console.error('⚠️ Failed to record reward transaction:', txnError.message);
  }

  return responseBuilder.success({
    status: 200,
    message: 'Zawadi imekusanywa kikamilifu! 🔥',
    data: {
      reward: rewardAmount,
      day: claimDay,
      streak: newStreak,
      balance: newBalance,
      total_daily_rewards: newTotalRewards,
      continues_streak: status.continues_streak
    }
  });
};

module.exports = {
  getDailyRewardStatus,
  claimDailyReward,
  computeDailyRewardStatus,
  REWARD_TIERS
};