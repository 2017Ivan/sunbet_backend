// controllers/admin/adminDashboard.controller.js
const adminDashboardService = require('../../services/admin/adminDashboard.service');

const getDashboard = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const result = await adminDashboardService.getDashboard({ limit });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard };