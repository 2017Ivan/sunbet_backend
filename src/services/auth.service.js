
// this is user services 
// auth.service.js 

const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../utils/jwt');
const { authPlugins } = require('mysql2');

const registerUser = async (phone_number, password) => {

  const existingUser = await userRepository.findByPhone(phone_number);

  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await userRepository.createUser({
    phone_number,
    password: hashedPassword
  });

  return {
    id: user.id,
    phone_number: user.phone_number
  };
};

const loginUser = async (phone_number, password) => {

  const user = await userRepository.findByPhone(phone_number);

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

 

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    id: user.id,
    phone_number: user.phone_number,
    accessToken,
    refreshToken
  };
 
};

const refreshAccessToken = async (refreshToken) => {

  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  const decoded = verifyRefreshToken(refreshToken);

  const user = await userRepository.findById(decoded.id);

  if (!user) {
    throw new Error('User not found');
  }

  const newAccessToken = generateAccessToken(user);

  return {
    accessToken: newAccessToken
  };
};


const deposit = async (userId, amount) => {
  // Validate amount
  if (!amount || amount <= 0) {
    throw new Error('Invalid deposit amount');
  }

  // Find user
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Calculate new balance
  const currentBalance = parseFloat(user.balance) || 0;
  const depositAmount = parseFloat(amount);
  const newBalance = currentBalance + depositAmount;

  // Update balance
  const updatedUser = await userRepository.updateBalance(userId, newBalance);

  return {
    id: updatedUser.id,
    phone_number: updatedUser.phone_number,
    previous_balance: currentBalance,
    deposited_amount: depositAmount,
    new_balance: newBalance
  };
};

const withdraw = async (userId, amount) => {
  // Validate amount
  if (!amount || amount <= 0) {
    throw new Error('Invalid withdrawal amount');
  }

  // Find user
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check sufficient balance
  const currentBalance = parseFloat(user.balance) || 0;
  const withdrawAmount = parseFloat(amount);

  if (currentBalance < withdrawAmount) {
    throw new Error('Insufficient balance');
  }

  // Calculate new balance
  const newBalance = currentBalance - withdrawAmount;

  // Update balance
  const updatedUser = await userRepository.updateBalance(userId, newBalance);

  return {
    id: updatedUser.id,
    phone_number: updatedUser.phone_number,
    previous_balance: currentBalance,
    withdrawn_amount: withdrawAmount,
    new_balance: newBalance
  };
};

const getBalance = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    phone_number: user.phone_number,
    balance: user.balance
  };
};




const getProfile = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    phone_number: user.phone_number,
    balance: user.balance,
    created_at: user.createdAt,
    updated_at: user.updatedAt
  };
};

const forgotPasswordRequest = async (phone_number) => {
  // Check if user exists with this phone number
  const user = await userRepository.findByPhone(phone_number);
  
  if (!user) {
    throw new Error('Phone number not found');
  }

  // Return success without revealing if user exists (security)
  return {
    success: true,
    message: 'If phone number exists, you can reset your password',
    userId: user.id // This will be used for reset
  };
};

const resetPassword = async (userId, newPassword, confirmPassword) => {
  // Check if passwords match
  if (newPassword !== confirmPassword) {
    throw new Error('Passwords do not match');
  }

  // Validate password strength (minimum length)
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }

  // Check if user exists
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  const updatedUser = await userRepository.updatePassword(userId, hashedPassword);

  return {
    success: true,
    message: 'Password reset successfully',
    phone_number: updatedUser.phone_number
  };
};

// Alternative: Single function that handles both steps
const changePasswordByPhone = async (phone_number, newPassword, confirmPassword) => {
  // First check if user exists
  const user = await userRepository.findByPhone(phone_number);
  
  if (!user) {
    throw new Error('Phone number not found');
  }

  // Check if passwords match
  if (newPassword !== confirmPassword) {
    throw new Error('Passwords do not match');
  }

  // Validate password strength
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  const updatedUser = await userRepository.updatePassword(user.id, hashedPassword);

  return {
    success: true,
    message: 'Password changed successfully',
    phone_number: updatedUser.phone_number
  };
};

// Admin: Get all users
const adminGetAllUsers = async (limit = 100, offset = 0) => {
  const result = await userRepository.getAllUsers(limit, offset);
  
  return {
    total: result.count,
    users: result.rows.map(user => ({
      id: user.id,
      phone_number: user.phone_number,
      balance: user.balance,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    }))
  };
};

// Admin: Get user by phone number
const adminGetUserByPhone = async (phone_number) => {
  const user = await userRepository.getUserByPhoneAdmin(phone_number);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return {
    id: user.id,
    phone_number: user.phone_number,
    balance: user.balance,
    created_at: user.createdAt,
    updated_at: user.updatedAt
  };
};

// Admin: Set exact balance for any user (by phone)
const adminSetBalanceByPhone = async (phone_number, newBalance) => {
  // Validate amount
  if (!newBalance || newBalance < 0) {
    throw new Error('Invalid balance amount');
  }
  
  const user = await userRepository.adminSetBalance(phone_number, newBalance, true);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return {
    id: user.id,
    phone_number: user.phone_number,
    previous_balance: user.balance,
    new_balance: newBalance,
    message: `Balance set to ${newBalance}`
  };
};

// Admin: Add balance to user (by phone)
const adminAddBalanceByPhone = async (phone_number, amount) => {
  // Validate amount
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount');
  }
  
  const user = await userRepository.adminAddBalance(phone_number, amount, true);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const currentBalance = parseFloat(user.balance);
  const addedAmount = parseFloat(amount);
  
  return {
    id: user.id,
    phone_number: user.phone_number,
    previous_balance: currentBalance - addedAmount,
    added_amount: addedAmount,
    new_balance: currentBalance,
    message: `Added ${amount} successfully`
  };
};

// Admin: Deduct balance from user (by phone)
const adminDeductBalanceByPhone = async (phone_number, amount) => {
  // Validate amount
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount');
  }
  
  try {
    const user = await userRepository.adminDeductBalance(phone_number, amount, true);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const currentBalance = parseFloat(user.balance);
    const deductedAmount = parseFloat(amount);
    
    return {
      id: user.id,
      phone_number: user.phone_number,
      previous_balance: currentBalance + deductedAmount,
      deducted_amount: deductedAmount,
      new_balance: currentBalance,
      message: `Deducted ${amount} successfully`
    };
  } catch (error) {
    if (error.message === 'User has insufficient balance') {
      throw new Error('User has insufficient balance');
    }
    throw error;
  }
};

// Admin: Delete user (by phone)
const adminDeleteUserByPhone = async (phone_number) => {
  const result = await userRepository.deleteUser(phone_number, true);
  
  if (!result) {
    throw new Error('User not found');
  }
  
  return {
    success: true,
    message: `User with phone ${phone_number} deleted successfully`
  };
};



module.exports = {
  refreshAccessToken,

  registerUser,
  loginUser,
  deposit,
  withdraw,
  getBalance,
  getProfile,
  forgotPasswordRequest, 
  resetPassword,
  changePasswordByPhone ,
  adminGetAllUsers,
  adminGetUserByPhone,
  adminSetBalanceByPhone,
  adminAddBalanceByPhone,
  adminDeductBalanceByPhone,
  adminDeleteUserByPhone
};