// repositories/transaction/transaction.repository.js
const Transaction = require('../../models/transaction/transaction.model');
const User = require('../../models/user/user.model');
const { Op } = require('sequelize');

// Tengeneza transaction mpya (inatumika kwenye deposit, withdraw, n.k.)
const createTransaction = async (data, transaction = null) => {
  return await Transaction.create(data, { transaction });
};

// ============ DEPOSITS (PROCESSING na ADMIN UTAZAMO) ============
// Inarudisha DEPOSIT transactions kila hali (SUCCESS/FAILED/PENDING) pamoja na
// taarifa za user, inakidhi 'completed na not completed' kwa admin dashboard.
const findDepositTransactions = async ({
  status = null,
  search = '',
  limit = 50,
  offset = 0
} = {}) => {
  const where = { type: 'DEPOSIT' };

  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [
      { reference: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { '$user.phone_number$': { [Op.like]: `%${search}%` } }
    ];
  }

  return await Transaction.findAndCountAll({
    where,
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'phone_number', 'role', 'status']
    }],
    limit,
    offset,
    distinct: true,
    subQuery: false,
    order: [['createdAt', 'DESC']]
  });
};

// Badilisha status ya deposit (SUCCESS/FAILED/PENDING) - na opcjonali crediting
const updateDepositStatus = async (id, status, transaction = null) => {
  const [updatedRows] = await Transaction.update(
    { status },
    { where: { id, type: 'DEPOSIT' }, transaction }
  );
  return updatedRows > 0;
};

const findDepositById = async (id, transaction = null) => {
  return await Transaction.findOne({
    where: { id, type: 'DEPOSIT' },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'phone_number', 'role', 'status', 'balance']
    }],
    transaction
  });
};

const getDepositStats = async () => {
  const [completed, pending, failed, total] = await Promise.all([
    Transaction.count({ where: { type: 'DEPOSIT', status: 'SUCCESS' } }),
    Transaction.count({ where: { type: 'DEPOSIT', status: 'PENDING' } }),
    Transaction.count({ where: { type: 'DEPOSIT', status: 'FAILED' } }),
    Transaction.sum('amount', { where: { type: 'DEPOSIT', status: 'SUCCESS' } })
  ]);
  return { completed, pending, failed, total: total || 0 };
};

// Dashboard: deposits/withdrawals ya leo + pending deposits
const getTransactionStats = async (dayStart) => {
  const whereToday = dayStart ? { createdAt: { [Op.gte]: dayStart } } : {};

  const [depositsToday, withdrawalsToday, pendingDeposits, totalDeposited] = await Promise.all([
    Transaction.sum('amount', { where: { type: 'DEPOSIT', status: 'SUCCESS', ...whereToday } }),
    Transaction.sum('amount', { where: { type: 'WITHDRAWAL', status: 'SUCCESS', ...whereToday } }),
    Transaction.count({ where: { type: 'DEPOSIT', status: 'PENDING' } }),
    Transaction.sum('amount', { where: { type: 'DEPOSIT', status: 'SUCCESS' } })
  ]);

  return {
    depositsToday: depositsToday || 0,
    withdrawalsToday: withdrawalsToday || 0,
    pendingDeposits: pendingDeposits || 0,
    totalDeposited: totalDeposited || 0
  };
};

module.exports = {
  createTransaction,
  findDepositTransactions,
  updateDepositStatus,
  findDepositById,
  getDepositStats,
  getTransactionStats
};