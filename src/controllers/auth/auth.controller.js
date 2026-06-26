// controllers/auth.controller.js
const userService = require('../../services/auth.service');

// ============ REGISTER ============
const register = async (req, res) => {
  try {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) {
      return res.status(400).json({ message: 'Phone and password required' });
    }
    const user = await userService.registerUser(phone_number, password);
    res.status(201).json({ message: 'User registered successfully', data: user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ============ LOGIN ============
const login = async (req, res) => {
  try {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) {
      return res.status(400).json({ message: 'Phone and password required' });
    }
    const user = await userService.loginUser(phone_number, password);
    res.status(200).json({ message: 'Login successful', data: user });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// ============ REFRESH TOKEN ============
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const newToken = await userService.refreshAccessToken(refreshToken);
    res.status(200).json({ message: 'Token refreshed', data: newToken });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// ============ FORGOT PASSWORD ============
const forgotPassword = async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number required' });
    }
    const result = await userService.forgotPasswordRequest(phone_number);
    res.status(200).json({ success: true, userId: result.userId });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============ RESET PASSWORD ============
const resetPassword = async (req, res) => {
  try {
    const { userId, newPassword, confirmPassword } = req.body;
    if (!userId || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields required' });
    }
    const result = await userService.resetPassword(userId, newPassword, confirmPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============ CHANGE PASSWORD ============
const changePasswordByPhone = async (req, res) => {
  try {
    const { phone_number, newPassword, confirmPassword } = req.body;
    if (!phone_number || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields required' });
    }
    const result = await userService.changePasswordByPhone(phone_number, newPassword, confirmPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============ GET PROFILE ============
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userService.getProfile(userId);
    res.status(200).json({ message: 'Profile retrieved', data: user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ============ EXPORT ============
module.exports = {
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePasswordByPhone,
  getProfile
};