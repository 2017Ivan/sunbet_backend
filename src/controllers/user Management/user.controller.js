// controllers/user.controller.js
const userService = require('../../services/auth.service');

/**
 * GET /api/admin/users - Get all users
 */
const adminGetAllUsers = async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    const result = await userService.adminGetAllUsers({
      search,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/users/:id - Get user by ID
 */
const adminGetUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userService.adminGetUserById(id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/users/phone/:phone - Get user by phone
 */
const adminGetUserByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const result = await userService.adminGetUserByPhone(phone);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/admin/users/:id/balance - Adjust user balance
 */
const adminAdjustBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, amount } = req.body;

    if (!['add', 'deduct', 'set'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be add, deduct, or set'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    const result = await userService.adminAdjustBalance(id, action, amount);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/admin/users/:id - Delete user
 */
const adminDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userService.adminDeleteUser(id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============ EXPORT ============
module.exports = {
  adminGetAllUsers,
  adminGetUserById,
  adminGetUserByPhone,
  adminAdjustBalance,
  adminDeleteUser
};