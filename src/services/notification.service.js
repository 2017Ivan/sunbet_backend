// services/notification.service.js
const notificationRepository = require('../repositories/notification.repository');

// ============ USER SERVICE FUNCTIONS ============

// Get user's own notifications
const getMyNotifications = async (userId, limit = 50, offset = 0, unreadOnly = false) => {
  return await notificationRepository.getUserNotifications(userId, limit, offset, unreadOnly);
};

// Get user's unread count
const getMyUnreadCount = async (userId) => {
  return await notificationRepository.getUnreadCount(userId);
};

// Mark as read
const markMyNotificationAsRead = async (notificationId, userId) => {
  const notification = await notificationRepository.markAsRead(notificationId, userId);
  if (!notification) {
    throw new Error('Notification not found');
  }
  return notification;
};

// Mark all as read
const markAllMyNotificationsAsRead = async (userId) => {
  const count = await notificationRepository.markAllAsRead(userId);
  return { marked_count: count };
};

// Delete my notification
const deleteMyNotification = async (notificationId, userId) => {
  const result = await notificationRepository.deleteNotification(notificationId, userId);
  if (!result) {
    throw new Error('Notification not found');
  }
  return { success: true };
};

// ============ ADMIN SERVICE FUNCTIONS ============

// Send notification to single user by phone number
const sendNotificationToUser = async (phone_number, title, message, type = 'info', metadata = null, sentBy = null) => {
  const user = await notificationRepository.getUserByPhone(phone_number);
  if (!user) {
    throw new Error(`User with phone number ${phone_number} not found`);
  }
  
  const notification = await notificationRepository.createNotification({
    user_id: user.id,
    title,
    message,
    type,
    metadata,
    sent_by: sentBy
  });
  
  return {
    id: notification.id,
    user_id: user.id,
    phone_number: user.phone_number,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    created_at: notification.createdAt
  };
};

// Send notification to multiple users by phone numbers
const sendNotificationToMultipleUsers = async (phone_numbers, title, message, type = 'info', metadata = null, sentBy = null) => {
  const successful = [];
  const failed = [];
  const notificationsData = [];
  
  for (const phone of phone_numbers) {
    const user = await notificationRepository.getUserByPhone(phone);
    if (user) {
      notificationsData.push({
        user_id: user.id,
        title,
        message,
        type,
        metadata,
        sent_by: sentBy
      });
      successful.push(phone);
    } else {
      failed.push(phone);
    }
  }
  
  if (notificationsData.length === 0) {
    throw new Error('No valid users found');
  }
  
  const notifications = await notificationRepository.bulkCreateNotifications(notificationsData);
  
  return {
    sent_count: notifications.length,
    successful_phones: successful,
    failed_phones: failed,
    notifications: notifications.map(n => ({
      id: n.id,
      title: n.title,
      type: n.type
    }))
  };
};

// Send broadcast to all users
const sendBroadcastToAllUsers = async (title, message, type = 'promotion', metadata = null, sentBy = null) => {
  const userIds = await notificationRepository.getAllUsersIds();
  
  if (userIds.length === 0) {
    throw new Error('No users found');
  }
  
  const notificationsData = userIds.map(userId => ({
    user_id: userId,
    title,
    message,
    type,
    metadata,
    sent_by: sentBy
  }));
  
  const notifications = await notificationRepository.bulkCreateNotifications(notificationsData);
  
  return {
    sent_count: notifications.length,
    total_users: userIds.length
  };
};

// Get user notifications by phone (admin)
const getUserNotificationsByPhone = async (phone_number, limit = 50) => {
  const result = await notificationRepository.getNotificationsByUserPhone(phone_number, limit);
  if (!result) {
    throw new Error(`User with phone number ${phone_number} not found`);
  }
  return result;
};

// Get user unread count by phone (admin)
const getUserUnreadCountByPhone = async (phone_number) => {
  const count = await notificationRepository.getUnreadCountByPhone(phone_number);
  if (count === null) {
    throw new Error(`User with phone number ${phone_number} not found`);
  }
  return { phone_number, unread_count: count };
};

// Get all notifications (admin)
const getAllNotifications = async (limit = 100, offset = 0, filters = {}) => {
  return await notificationRepository.getAllNotifications(limit, offset, filters);
};

// Check if user exists by phone
const checkUserExists = async (phone_number) => {
  const user = await notificationRepository.getUserByPhone(phone_number);
  return {
    exists: !!user,
    user: user || null
  };
};

module.exports = {
  // User services
  getMyNotifications,
  getMyUnreadCount,
  markMyNotificationAsRead,
  markAllMyNotificationsAsRead,
  deleteMyNotification,
  // Admin services
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
  sendBroadcastToAllUsers,
  getUserNotificationsByPhone,
  getUserUnreadCountByPhone,
  getAllNotifications,
  checkUserExists
};