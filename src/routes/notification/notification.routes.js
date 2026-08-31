// routes/notification/notification.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const notificationController = require('../../controllers/notification/notification.controller');
const deviceTokenController = require('../../controllers/device/deviceToken.controller');

// ============ DEVICE (LOGGED-IN USER) - FCM PUSH TOKENS ============
router.post('/device-token', authenticate, deviceTokenController.registerToken);
router.delete('/device-token', authenticate, deviceTokenController.unregisterToken);

// ============ ADMIN - SEND ============
router.post('/send-to-user', authenticate, authorize(['ADMIN']), notificationController.sendToUser);
router.post('/send-to-multiple', authenticate, authorize(['ADMIN']), notificationController.sendToMultiple);
router.post('/send-to-all', authenticate, authorize(['ADMIN']), notificationController.sendToAll);

// ============ USER - MY NOTIFICATIONS ============
router.get('/my', authenticate, notificationController.getMyNotifications);
router.get('/my/unread-count', authenticate, notificationController.getMyUnreadCount);
router.put('/my/read-all', authenticate, notificationController.markAllRead);
router.put('/my/:id/read', authenticate, notificationController.markOneRead);
router.delete('/my/:id', authenticate, notificationController.deleteOne);

// ============ ADMIN - QUERIES ============
router.get('/all', authenticate, authorize(['ADMIN']), notificationController.getAllAdmin);
router.get('/check-user/:phone', authenticate, authorize(['ADMIN']), notificationController.checkUser);
router.get('/user/:phone/unread-count', authenticate, authorize(['ADMIN']), notificationController.getUserUnreadByPhone);
router.get('/user/:phone', authenticate, authorize(['ADMIN']), notificationController.getByPhone);

module.exports = router;