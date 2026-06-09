// routes/notification.routes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdminByPhone } = require('../middleware/admin.middleware');

// All routes require authentication first
router.use(authenticate);

// ============ USER ROUTES (for authenticated users - any user) ============
router.get('/my', notificationController.getMyNotifications);
router.get('/my/unread-count', notificationController.getMyUnreadCount);
router.put('/:notificationId/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);

// ============ ADMIN ROUTES (require admin middleware) ============
// All admin routes are protected by isAdminByPhone middleware

// Check if user exists
router.get('/admin/check/:phone_number', isAdminByPhone, notificationController.checkUser);

// Get user's unread count by phone
router.get('/admin/unread-count/:phone_number', isAdminByPhone, notificationController.getUserUnreadCount);

// Get user's notifications by phone
router.get('/admin/user/:phone_number', isAdminByPhone, notificationController.getUserNotifications);

// Get all notifications (system-wide)
router.get('/admin/all', isAdminByPhone, notificationController.getAllNotifications);

// Send to single user
router.post('/admin/send', isAdminByPhone, notificationController.sendToUser);

// Send to multiple users
router.post('/admin/send-multiple', isAdminByPhone, notificationController.sendToMultipleUsers);

// Send broadcast to all users
router.post('/admin/send-all', isAdminByPhone, notificationController.sendToAllUsers);

module.exports = router;