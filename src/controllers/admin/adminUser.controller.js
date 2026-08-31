// controllers/admin/adminUser.controller.js
const adminUserService = require('../../services/admin/adminUser.service');

const getUsers = async (req, res, next) => {
  try {
    const { search, limit, offset } = req.query;
    const result = await adminUserService.getUsers({ search, limit, offset });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const result = await adminUserService.getUserById(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getUserByPhone = async (req, res, next) => {
  try {
    const result = await adminUserService.getUserByPhone(req.params.phone);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const adjustBalance = async (req, res, next) => {
  try {
    const { action, amount } = req.body;
    const result = await adminUserService.adjustBalance(req.params.id, action, amount);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await adminUserService.deleteUser(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUserById,
  getUserByPhone,
  adjustBalance,
  deleteUser
};