// controllers/notification.controller.js
const notificationService = require('../services/notification.service');

// ============ USER CONTROLLERS (no admin logic here) ============

const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;
    
    const result = await notificationService.getMyNotifications(
      userId,
      parseInt(limit),
      parseInt(offset),
      unreadOnly === 'true'
    );
    
    res.status(200).json({
      success: true,
      data: {
        total: result.total,
        notifications: result.notifications
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getMyUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.getMyUnreadCount(userId);
    
    res.status(200).json({
      success: true,
      data: { unread_count: count }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    
    const notification = await notificationService.markMyNotificationAsRead(notificationId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.markAllMyNotificationsAsRead(userId);
    
    res.status(200).json({
      success: true,
      message: `${result.marked_count} notifications marked as read`
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    
    await notificationService.deleteMyNotification(notificationId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============ ADMIN CONTROLLERS ============

const sendToUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { phone_number, title, message, type = 'info', metadata = null } = req.body;
    
    const result = await notificationService.sendNotificationToUser(
      phone_number, title, message, type, metadata, adminId
    );
    
    res.status(200).json({
      success: true,
      message: `Notification sent to ${phone_number}`,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const sendToMultipleUsers = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { phone_numbers, title, message, type = 'info', metadata = null } = req.body;
    
    const result = await notificationService.sendNotificationToMultipleUsers(
      phone_numbers, title, message, type, metadata, adminId
    );
    
    res.status(200).json({
      success: true,
      message: `Sent to ${result.sent_count} users`,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const sendToAllUsers = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { title, message, type = 'promotion', metadata = null } = req.body;
    
    const result = await notificationService.sendBroadcastToAllUsers(
      title, message, type, metadata, adminId
    );
    
    res.status(200).json({
      success: true,
      message: `Broadcast sent to ${result.sent_count} users`,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getUserNotifications = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const { limit = 50 } = req.query;
    
    const result = await notificationService.getUserNotificationsByPhone(phone_number, parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const getUserUnreadCount = async (req, res) => {
  try {
    const { phone_number } = req.params;
    
    const result = await notificationService.getUserUnreadCountByPhone(phone_number);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const getAllNotifications = async (req, res) => {
  try {
    const { limit = 100, offset = 0, user_id, type, is_read } = req.query;
    
    const filters = {};
    if (user_id) filters.user_id = user_id;
    if (type) filters.type = type;
    if (is_read !== undefined) filters.is_read = is_read === 'true';
    
    const result = await notificationService.getAllNotifications(
      parseInt(limit), parseInt(offset), filters
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const checkUser = async (req, res) => {
  try {
    const { phone_number } = req.params;
    
    const result = await notificationService.checkUserExists(phone_number);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  // User exports
  getMyNotifications,
  getMyUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  // Admin exports
  sendToUser,
  sendToMultipleUsers,
  sendToAllUsers,
  getUserNotifications,
  getUserUnreadCount,
  getAllNotifications,
  checkUser
};