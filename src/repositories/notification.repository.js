// repositories/notification.repository.js
const Notification = require('../models/notification.model');
const User = require('../models/user.model');

// Create notification for single user
const createNotification = async (data) => {
  return await Notification.create(data);
};

// Bulk create notifications
const bulkCreateNotifications = async (notificationsData) => {
  return await Notification.bulkCreate(notificationsData);
};

// Get user's own notifications
const getUserNotifications = async (userId, limit = 50, offset = 0, unreadOnly = false) => {
  const where = { user_id: userId };
  if (unreadOnly) {
    where.is_read = false;
  }
  
  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });
  
  return { total: count, notifications: rows };
};

// Get unread count for user
const getUnreadCount = async (userId) => {
  return await Notification.count({
    where: {
      user_id: userId,
      is_read: false
    }
  });
};

// Mark single notification as read
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    where: { id: notificationId, user_id: userId }
  });
  
  if (!notification) return null;
  
  notification.is_read = true;
  notification.read_at = new Date();
  await notification.save();
  return notification;
};

// Mark all as read
const markAllAsRead = async (userId) => {
  const [updatedCount] = await Notification.update(
    { is_read: true, read_at: new Date() },
    { where: { user_id: userId, is_read: false } }
  );
  return updatedCount;
};

// Delete notification
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    where: { id: notificationId, user_id: userId }
  });
  
  if (!notification) return null;
  await notification.destroy();
  return true;
};

// ============ ADMIN REPOSITORY FUNCTIONS ============

// Get notification by ID (admin)
const getNotificationById = async (notificationId) => {
  return await Notification.findByPk(notificationId, {
    include: [{ model: User, as: 'user', attributes: ['id', 'phone_number'] }]
  });
};

// Get all notifications with filters (admin)
const getAllNotifications = async (limit = 100, offset = 0, filters = {}) => {
  const where = {};
  if (filters.user_id) where.user_id = filters.user_id;
  if (filters.type) where.type = filters.type;
  if (filters.is_read !== undefined) where.is_read = filters.is_read;
  
  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    include: [{ model: User, as: 'user', attributes: ['id', 'phone_number'] }]
  });
  
  return { total: count, notifications: rows };
};

// Get notifications by user phone (admin)
const getNotificationsByUserPhone = async (phone_number, limit = 50) => {
  const user = await User.findOne({ where: { phone_number } });
  if (!user) return null;
  
  return await getUserNotifications(user.id, limit);
};

// Get unread count by phone (admin)
const getUnreadCountByPhone = async (phone_number) => {
  const user = await User.findOne({ where: { phone_number } });
  if (!user) return null;
  
  return await getUnreadCount(user.id);
};

// Get user by phone (admin helper)
const getUserByPhone = async (phone_number) => {
  return await User.findOne({ 
    where: { phone_number },
    attributes: ['id', 'phone_number', 'balance']
  });
};

// Get all users (for broadcast)
const getAllUsersIds = async () => {
  const users = await User.findAll({
    attributes: ['id'],
    raw: true
  });
  return users.map(u => u.id);
};

module.exports = {
  // User functions
  createNotification,
  bulkCreateNotifications,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  // Admin functions
  getNotificationById,
  getAllNotifications,
  getNotificationsByUserPhone,
  getUnreadCountByPhone,
  getUserByPhone,
  getAllUsersIds
};