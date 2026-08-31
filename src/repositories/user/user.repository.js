// repositories/user.repository.js
const User = require('../../models/user/user.model');
const { Op } = require('sequelize');

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
const deposite = async (id, newBalance) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  
  user.balance = newBalance;
  await user.save();
  return user;
};



const withdraw = async (id, newBalance) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  user.balance = newBalance;
  await user.save();
  return user;
};

// Add amount to balance INSIDE a transaction (used by bet settlement payouts)
const deposit = async (id, amount, transaction = null) => {
  const user = await User.findByPk(id, {
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined
  });
  if (!user) return null;

  const currentBalance = parseFloat(user.balance || 0);
  const depositAmount = parseFloat(amount);
  user.balance = parseFloat((currentBalance + depositAmount).toFixed(2));
  await user.save({ transaction });
  return user;
};

// ============ GET BALANCE ============
const getBalance = async (id) => {
  const user = await User.findByPk(id, {
    attributes: ['id', 'phone_number', 'balance']
  });
  return user;
};

// not checked 

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


const getAllUsers = async ({
  search = '',
  limit = 50,
  offset = 0
} = {}) => {

  const where = {};

  if (search) {
    where.phone_number = {
      [Op.like]: `%${search}%`
    };
  }

  return await User.findAndCountAll({
    where,
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

// Broadcast - user_ids zote za watumiaji (ADMIN/USER)
const findAllUserIds = async () => {
  return await User.findAll({
    attributes: ['id'],
    where: { role: 'USER' }
  });
};

// Hesabu users kwa role (dashboard)
const countUsers = async (role = 'USER') => {
  return await User.count({ where: { role } });
};

// Hesabu users WOTE (dashboard - total users)
const countAllUsers = async () => {
  return await User.count();
};

module.exports = {
  createUser,
  findByPhone,
  findById,
  deposite,
  withdraw, 
  deposit,
  addBalance,
  updatePassword,    
  checkUserExists,
  getAllUsers,
  getUserByPhoneAdmin,
  adminSetBalance,
  adminAddBalance,
  adminDeductBalance,
  deleteUser,
  getBalance,
  findAllUserIds,
  countUsers,
  countAllUsers,
};