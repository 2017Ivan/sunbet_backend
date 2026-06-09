const DepositTransaction = require('../models/depositTransaction.model');

const createTransaction = async (data) => {
  return await DepositTransaction.create(data);
};

const findByOrderId = async (order_id) => {
  return await DepositTransaction.findOne({ where: { order_id } });
};

const updateStatus = async (order_id, status, transactionData = {}) => {
  const transaction = await DepositTransaction.findOne({ where: { order_id } });
  if (!transaction) return null;
  
  transaction.status = status;
  if (transactionData.mongike_id) transaction.mongike_id = transactionData.mongike_id;
  if (transactionData.gateway_ref) transaction.gateway_ref = transactionData.gateway_ref;
  if (transactionData.transaction_id) transaction.transaction_id = transactionData.transaction_id;
  if (status === 'completed') transaction.completed_at = new Date();
  if (transactionData.expires_at) transaction.expires_at = transactionData.expires_at;
  
  await transaction.save();
  return transaction;
};

const getPendingByUser = async (user_id) => {
  return await DepositTransaction.findAll({
    where: { 
      user_id,
      status: 'pending'
    },
    order: [['createdAt', 'DESC']]
  });
};

const getByUser = async (user_id, limit = 10) => {
  return await DepositTransaction.findAll({
    where: { user_id },
    order: [['createdAt', 'DESC']],
    limit
  });
};

const expireOldTransactions = async () => {
  return await DepositTransaction.update(
    { status: 'expired' },
    {
      where: {
        status: 'pending',
        expires_at: { [Op.lt]: new Date() }
      }
    }
  );
};

module.exports = {
  createTransaction,
  findByOrderId,
  updateStatus,
  getPendingByUser,
  getByUser,
  expireOldTransactions
};