// controllers/auth.controller.js
const userService = require('../../services/auth/auth.service');
const responseBuilder = require('../../utils/response.builder')


// ============ REGISTER ============
async function register(req, res,next){
  try {
     const { phone_number, password, promo_code } = req.body;
    const result = await userService.registerUser(phone_number, password, promo_code);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    next(err)
  }
};

// ============ LOGIN ============
async function login(req, res,next) {
  try {
    const { phone_number, password } = req.body;
    const result = await userService.loginUser(phone_number, password);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    next(err)
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
const getProfile = async (req, res,next) => {
  try {
    const userId = req.user.id;
    const user = await userService.getProfile(userId);
    // Hakikisha inarudisha balance
    res.status(200).json({ 
      message: 'Profile retrieved', 
      data: {
        id: user.id,
        phone_number: user.phone_number,
        balance: user.balance, // <- Hii ni muhimu!
        role: user.role,
        status: user.status,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      }
    });
  } catch (err) {
    next(err)
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