// services/admin/adminDeposit.service.js

const { sequelize } = require('../../models');
const userRepository = require('../../repositories/user/user.repository');
const transactionRepository = require('../../repositories/transaction/transaction.repository');
const CustomExceptions = require('../../middleware/CustomExceptions');
const responseBuilder = require('../../utils/response.builder');

const generateReference = (prefix = 'DEP') => {
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${randomDigits}`;
};

// Orodha ya deposits zote (completed na not completed) - admin only
const getDeposits = async ({ status = 'ALL', search = '', limit = 50, offset = 0 } = {}) => {
  const result = await transactionRepository.findDepositTransactions({
    status,
    search,
    limit: parseInt(limit, 10) || 50,
    offset: parseInt(offset, 10) || 0
  });

  const formatted = result.rows.map((txn) => {
    const json = txn.toJSON ? txn.toJSON() : txn;
    return {
      id: json.id,
      reference: json.reference,
      amount: json.amount ? String(json.amount) : '0',
      balance_before: json.balance_before ? String(json.balance_before) : '0',
      balance_after: json.balance_after ? String(json.balance_after) : '0',
      status: json.status,
      description: json.description,
      created_at: json.createdAt,
      user: json.user || null
    };
  });

  return responseBuilder.success({
    status: 200,
    message: 'Deposit transactions',
    data: {
      deposits: formatted,
      total: result.count,
      stats: await transactionRepository.getDepositStats()
    }
  });
};

// Admin atengeneza deposit ya PENDING (mf. malipo ya benki/mobile money yanayosubiri)
const createPendingDeposit = async ({ user_id = null, phone_number = null, amount, description = '' }) => {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new CustomExceptions('Invalid amount', 400);
  }

  let user = null;
  if (user_id) user = await userRepository.findById(user_id);
  if (!user && phone_number) user = await userRepository.findByPhone(phone_number);
  if (!user) {
    throw new CustomExceptions('User not found', 404);
  }

  const transaction = await transactionRepository.createTransaction({
    reference: generateReference('DEP'),
    user_id: user.id,
    type: 'DEPOSIT',
    amount: numericAmount,
    balance_before: parseFloat(user.balance) || 0,
    balance_after: parseFloat(user.balance) || 0,
    status: 'PENDING',
    description: description || `Manual deposit pending for ${user.phone_number}`
  });

  return responseBuilder.success({
    status: 201,
    message: 'Deposit uundwa kama PENDING - IDHINI au UKATAE baadaye.',
    data: { deposit_id: transaction.id }
  });
};

// IDHINI deposit: ikifika kwenye balance ya user na ikawa SUCCESS
const confirmDeposit = async (depositId) => {
  const transaction = await sequelize.transaction();
  try {
    const deposit = await transactionRepository.findDepositById(depositId, transaction);
    if (!deposit) {
      throw new CustomExceptions('Deposit haipatikani', 404);
    }
    if (deposit.status === 'SUCCESS') {
      throw new CustomExceptions('Deposit hii tayari imeidhiniwa', 400);
    }
    if (deposit.status === 'FAILED') {
      throw new CustomExceptions('Deposit hii imekataliwa - haidhiniwi', 400);
    }

    const updatedUser = await userRepository.deposit(deposit.user_id, parseFloat(deposit.amount), transaction);
    const newBalance = parseFloat(updatedUser.balance);

    await deposit.update({
      status: 'SUCCESS',
      balance_after: newBalance
    }, { transaction });

    await transaction.commit();
    return responseBuilder.success({
      status: 200,
      message: 'Deposit imeidhiniwa - balance imeongezwa.',
      data: {
        deposit_id: depositId,
        amount: deposit.amount,
        new_balance: newBalance,
        status: 'SUCCESS'
      }
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// KATA KATAZA deposit (hanu wi credit zitakapofikishwa)
const rejectDeposit = async (depositId) => {
  const deposit = await transactionRepository.findDepositById(depositId);
  if (!deposit) {
    throw new CustomExceptions('Deposit haipatikani', 404);
  }
  if (deposit.status === 'SUCCESS') {
    throw new CustomExceptions('Deposit iliyo tayari kuidhiniwa haitatu kataliwa', 400);
  }
  if (deposit.status === 'FAILED') {
    throw new CustomExceptions('Deposit hii tayari imekataliwa', 400);
  }

  await transactionRepository.updateDepositStatus(depositId, 'FAILED');
  return responseBuilder.success({
    status: 200,
    message: 'Deposit imekataliwa.',
    data: { deposit_id: depositId, status: 'FAILED' }
  });
};

module.exports = {
  getDeposits,
  createPendingDeposit,
  confirmDeposit,
  rejectDeposit
};