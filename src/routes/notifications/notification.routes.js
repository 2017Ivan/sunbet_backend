// routes/api/notification.routes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/notifications/notification.controller');
const { authenticate, authorize, validate } = require('../../middleware/auth.middleware');
const { body, param, query } = require('express-validator');

// ============================================
// VALIDATION RULES
// ============================================

// User validation
const validatePagination = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater'),
  query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be true or false')
];

const validateNotificationId = [
  param('notificationId').isUUID().withMessage('Invalid notification ID format')
];

// Admin validation
const validateSendToUser = [
  body('phone_number').notEmpty().withMessage('Phone number is required'),
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['info', 'promotion', 'alert', 'system']).withMessage('Invalid notification type'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
];

const validateSendToMultiple = [
  body('phone_numbers').isArray({ min: 1 }).withMessage('Phone numbers must be a non-empty array'),
  body('phone_numbers.*').notEmpty().withMessage('Each phone number is required'),
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['info', 'promotion', 'alert', 'system']).withMessage('Invalid notification type'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
];

const validateSendToAll = [
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['info', 'promotion', 'alert', 'system']).withMessage('Invalid notification type'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
];

const validatePhoneNumber = [
  param('phone_number').notEmpty().withMessage('Phone number is required')
];

const validateAdminGetAll = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater'),
  query('user_id').optional().isUUID().withMessage('Invalid user ID format'),
  query('type').optional().isIn(['info', 'promotion', 'alert', 'system']).withMessage('Invalid notification type'),
  query('is_read').optional().isBoolean().withMessage('is_read must be true or false')
];

// ============================================
// USER ROUTES (All authenticated users)
// ============================================

// Get my notifications
router.get(
  '/my',
  authenticate,
  validate(validatePagination),
  notificationController.getMyNotifications
);

// Get my unread count
router.get(
  '/my/unread-count',
  authenticate,
  notificationController.getMyUnreadCount
);

// Mark specific notification as read
router.put(
  '/my/:notificationId/read',
  authenticate,
  validate(validateNotificationId),
  notificationController.markAsRead
);

// Mark all my notifications as read
router.put(
  '/my/read-all',
  authenticate,
  notificationController.markAllAsRead
);

// Delete my notification
router.delete(
  '/my/:notificationId',
  authenticate,
  validate(validateNotificationId),
  notificationController.deleteNotification
);

// ============================================
// ADMIN ROUTES (Authenticated + Role: admin)
// ============================================

// Send notification to single user
router.post(
  '/send-to-user',
  authenticate,
  authorize('ADMIN'),
  validate(validateSendToUser),
  notificationController.sendToUser
);

// Send notification to multiple users
router.post(
  '/send-to-multiple',
  authenticate,
  authorize('ADMIN'),
  validate(validateSendToMultiple),
  notificationController.sendToMultipleUsers
);

// Send broadcast to all users
router.post(
  '/send-to-all',
  authenticate,
  authorize('ADMIN'),
  validate(validateSendToAll),
  notificationController.sendToAllUsers
);

// Get user's notifications by phone number
router.get(
  '/user/:phone_number',
  authenticate,
  authorize('ADMIN'),
  validate(validatePhoneNumber),
  notificationController.getUserNotifications
);

// Get user's unread count by phone number
router.get(
  '/user/:phone_number/unread-count',
  authenticate,
  authorize('ADMIN'),
  validate(validatePhoneNumber),
  notificationController.getUserUnreadCount
);

// Get all notifications (with filters)
router.get(
  '/all',
  authenticate,
  authorize('ADMIN'),
  validate(validateAdminGetAll),
  notificationController.getAllNotifications
);

// Check if user exists
router.get(
  '/check-user/:phone_number',
  authenticate,
  authorize('ADMIN'),
  validate(validatePhoneNumber),
  notificationController.checkUser
);

module.exports = router;