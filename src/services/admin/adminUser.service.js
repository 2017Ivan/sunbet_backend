// services/admin/adminUser.service.js

const userRepository = require('../../repositories/user/user.repository');
const CustomExceptions = require('../../middleware/CustomExceptions');
const responseBuilder = require('../../utils/response.builder');

function safeUser(user) {
  if (!user) return null;
  const json = user.toJSON ? user.toJSON() : user;
  const { password, ...safe } = json;
  return safe;
}

// Orodha ya watumiaji wote (admin pekee) - hutumia getAllUsers
const getUsers = async ({ search = '', limit = 50, offset = 0 } = {}) => {
  const intLimit = parseInt(limit, 10) || 50;
  const intOffset = parseInt(offset, 10) || 0;

  const { rows, count } = await userRepository.getAllUsers({
    search,
    limit: intLimit,
    offset: intOffset
  });

  const users = rows.map(safeUser);

  return responseBuilder.success({
    status: 200,
    message: 'Users retrieved',
    data: {
      users,
      total: count,
      hasMore: intOffset + users.length < count,
      limit: intLimit,
      offset: intOffset
    }
  });
};

const getUserById = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new CustomExceptions('User not found', 404);
  }
  return responseBuilder.success({
    status: 200,
    message: 'User retrieved',
    data: safeUser(user)
  });
};

const getUserByPhone = async (phone) => {
  const user = await userRepository.getUserByPhoneAdmin(phone);
  if (!user) {
    throw new CustomExceptions('User not found', 404);
  }
  return responseBuilder.success({
    status: 200,
    message: 'User retrieved',
    data: safeUser(user)
  });
};

// Badilisha balance: action = 'set' | 'add' | 'deduct'
const adjustBalance = async (userId, action, amount) => {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    throw new CustomExceptions('Invalid amount', 400);
  }

  let updated;
  if (action === 'set') {
    updated = await userRepository.adminSetBalance(userId, numericAmount);
  } else if (action === 'add') {
    updated = await userRepository.adminAddBalance(userId, numericAmount);
  } else if (action === 'deduct') {
    if (numericAmount <= 0) {
      throw new CustomExceptions('Invalid amount', 400);
    }
    updated = await userRepository.adminDeductBalance(userId, numericAmount);
  } else {
    throw new CustomExceptions("Invalid action - tumia 'set', 'add' au 'deduct'", 400);
  }

  if (!updated) {
    throw new CustomExceptions('User not found', 404);
  }

  return responseBuilder.success({
    status: 200,
    message: 'Balance updated successfully',
    data: safeUser(updated)
  });
};

const deleteUser = async (userId) => {
  const deleted = await userRepository.deleteUser(userId);
  if (!deleted) {
    throw new CustomExceptions('User not found', 404);
  }
  return responseBuilder.success({
    status: 200,
    message: 'User deleted successfully',
    data: { id: userId }
  });
};

module.exports = {
  getUsers,
  getUserById,
  getUserByPhone,
  adjustBalance,
  deleteUser
};