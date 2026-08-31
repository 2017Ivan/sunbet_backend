// controllers/admin/adminDeposit.controller.js
const adminDepositService = require('../../services/admin/adminDeposit.service');

const getDeposits = async (req, res, next) => {
  try {
    const { status, search, limit, offset } = req.query;
    const result = await adminDepositService.getDeposits({ status, search, limit, offset });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const createPendingDeposit = async (req, res, next) => {
  try {
    const { user_id, phone_number, amount, description } = req.body;
    const result = await adminDepositService.createPendingDeposit({ user_id, phone_number, amount, description });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const confirmDeposit = async (req, res, next) => {
  try {
    const result = await adminDepositService.confirmDeposit(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const rejectDeposit = async (req, res, next) => {
  try {
    const result = await adminDepositService.rejectDeposit(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDeposits,
  createPendingDeposit,
  confirmDeposit,
  rejectDeposit
};