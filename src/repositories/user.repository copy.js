// repositories/user.repository.js
const User = require('../models/user.model');

const createUser = async (data) => {
  return await User.create(data);
};

const findByPhone = async (phone_number) => {
  return await User.findOne({ where: { phone_number } });
};

const findById = async (id) => {
  return await User.findByPk(id);
};

// Update balance (set to specific amount)
const updateBalance = async (id, newBalance) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  
  user.balance = newBalance;
  await user.save();
  return user;
};

// ADD THIS - Deduct amount from balance
const deductBalance = async (id, amount) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < amount) {
    throw new Error('Insufficient balance');
  }
  
  user.balance = currentBalance - parseFloat(amount);
  await user.save();
  return user;
};

// ADD THIS - Add amount to balance
const addBalance = async (id, amount) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  
  const currentBalance = parseFloat(user.balance);
  user.balance = currentBalance + parseFloat(amount);
  await user.save();
  return user;
};

module.exports = {
  createUser,
  findByPhone,
  findById,
  updateBalance,
  deductBalance, // Add this
  addBalance     // Add this
};