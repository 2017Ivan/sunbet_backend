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
const updatePassword = async (id, newPassword) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  
  user.password = newPassword;
  await user.save();
  return user;
};

const checkUserExists = async (phone_number) => {
  const user = await User.findOne({ where: { phone_number } });
  return user ? true : false;
};

// Get all users (with pagination option)
const getAllUsers = async (limit = 100, offset = 0) => {
  return await User.findAndCountAll({
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
};

// Get user by phone number with full details (admin view)
const getUserByPhoneAdmin = async (phone_number) => {
  return await User.findOne({ 
    where: { phone_number },
    attributes: { exclude: ['password'] }
  });
};

// Admin: Set exact balance for any user (by id or phone)
const adminSetBalance = async (identifier, newBalance, usePhone = false) => {
  let user;
  if (usePhone) {
    user = await User.findOne({ where: { phone_number: identifier } });
  } else {
    user = await User.findByPk(identifier);
  }
  if (!user) return null;
  
  user.balance = parseFloat(newBalance);
  await user.save();
  return user;
};

// Admin: Add amount to any user's balance (by id or phone)
const adminAddBalance = async (identifier, amount, usePhone = false) => {
  let user;
  if (usePhone) {
    user = await User.findOne({ where: { phone_number: identifier } });
  } else {
    user = await User.findByPk(identifier);
  }
  if (!user) return null;
  
  const currentBalance = parseFloat(user.balance);
  user.balance = currentBalance + parseFloat(amount);
  await user.save();
  return user;
};

// Admin: Deduct amount from any user's balance (by id or phone)
const adminDeductBalance = async (identifier, amount, usePhone = false) => {
  let user;
  if (usePhone) {
    user = await User.findOne({ where: { phone_number: identifier } });
  } else {
    user = await User.findByPk(identifier);
  }
  if (!user) return null;
  
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < parseFloat(amount)) {
    throw new Error('User has insufficient balance');
  }
  
  user.balance = currentBalance - parseFloat(amount);
  await user.save();
  return user;
};

// Delete user (admin only) - by id or phone
const deleteUser = async (identifier, usePhone = false) => {
  let user;
  if (usePhone) {
    user = await User.findOne({ where: { phone_number: identifier } });
  } else {
    user = await User.findByPk(identifier);
  }
  if (!user) return null;
  
  await user.destroy();
  return true;
};

module.exports = {
  createUser,
  findByPhone,
  findById,
  updateBalance,
  deductBalance, 
  addBalance     ,
  updatePassword,    
  checkUserExists  ,
  getAllUsers,
  getUserByPhoneAdmin,
  adminSetBalance,
  adminAddBalance,
  adminDeductBalance,
  deleteUser
};