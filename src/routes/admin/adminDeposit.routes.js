// routes/admin/adminDeposit.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const adminDepositController = require('../../controllers/admin/adminDeposit.controller');
const adminDashboardController = require('../../controllers/admin/adminDashboard.controller');

// Admin Dashboard - data halisi kutoka DB
router.get('/dashboard', authenticate, authorize(['ADMIN']), adminDashboardController.getDashboard);

// Admin pekee ndiye anayeweza kuona deposits zote na kuzisimamia
router.get('/deposits', authenticate, authorize(['ADMIN']), adminDepositController.getDeposits);
router.post('/deposits', authenticate, authorize(['ADMIN']), adminDepositController.createPendingDeposit);
router.patch('/deposits/:id/confirm', authenticate, authorize(['ADMIN']), adminDepositController.confirmDeposit);
router.patch('/deposits/:id/reject', authenticate, authorize(['ADMIN']), adminDepositController.rejectDeposit);

module.exports = router;