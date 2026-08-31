// services/admin/adminDashboard.service.js

const userRepository = require('../../repositories/user/user.repository');
const betRepository = require('../../repositories/bet/bet.repository');
const transactionRepository = require('../../repositories/transaction/transaction.repository');
const notificationRepository = require('../../repositories/notification/notification.repository');
const responseBuilder = require('../../utils/response.builder');

// Admin dashboard - data halisi kutoka DB
// Stat 4: Total Users, Total Deposits Today, Bets Today, Notifications Today
const getDashboard = async ({ limit = 8 } = {}) => {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [totalUsers, betStats, txnStats, notificationsToday] = await Promise.all([
    userRepository.countAllUsers(),
    betRepository.getBetStats(dayStart),
    transactionRepository.getTransactionStats(dayStart),
    notificationRepository.countCreatedToday(dayStart)
  ]);

  const recentBets = await betRepository.findRecentBetsAdmin(limit);

  const formattedBets = recentBets.map((b) => {
    const j = b.toJSON ? b.toJSON() : b;
    return {
      id: j.id,
      ticket_code: j.ticket_code,
      phone_number: j.user?.phone_number || null,
      stake: j.stake ? String(j.stake) : '0',
      total_odds: j.total_odds ? String(j.total_odds) : '0',
      possible_win: j.possible_win ? String(j.possible_win) : '0',
      result: j.result,
      status: j.status,
      placed_via: j.placed_via,
      created_at: j.createdAt
    };
  });

  return responseBuilder.success({
    status: 200,
    message: 'Admin dashboard data',
    data: {
      stats: {
        total_users: totalUsers,
        deposits_today: txnStats.depositsToday,
        bets_today: betStats.betsToday,
        notifications_today: notificationsToday
      },
      recent_bets: formattedBets
    }
  });
};

module.exports = { getDashboard };