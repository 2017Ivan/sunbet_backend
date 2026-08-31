// repositories/notification/notification.repository.js
const Notification = require('../../models/notification/notification.model');
const User = require('../../models/user/user.model');
const { Op } = require('sequelize');

// ============ CREATE ============

// Create single notification
const createNotification = async ({ user_id, type = 'info', title = 'Notification', message, metadata = null }) => {
  return await Notification.create({
    user_id,
    type,
    title,
    message,
    metadata
  });
};

// Bulk create (broadcast - user notifications)
const createMany = async (notifications) => {
  return await Notification.bulkCreate(notifications, {
    validate: true
  });
};

// Add amount to balance INSIDE a transaction? (not needed here)

// ============ USER QUERIES ============

// Get logged-in user's notifications (paginated)
const findUserNotifications = async ({ user_id, limit = 50, offset = 0, unreadOnly = false }) => {
  const where = { user_id };
  if (unreadOnly) where.is_read = false;

  const result = await Notification.findAndCountAll({
    where,
    limit: parseInt(limit, 10) || 50,
    offset: parseInt(offset, 10) || 0,
    order: [['createdAt', 'DESC']]
  });

  return result;
};

// Count unread notifications for a user
const countUnread = async (user_id) => {
  return await Notification.count({
    where: { user_id, is_read: false }
  });
};

// Count all unread (stats - broadcast)
const countUnreadAll = async () => {
  return await Notification.count({
    where: { is_read: false }
  });
};

// Count all (stats)
const countAll = async () => {
  return await Notification.count();
};

// Count notifications zilizoundwa leo (kutoka dayStart)
const countCreatedToday = async (dayStart) => {
  return await Notification.count({
    where: { createdAt: { [Op.gte]: dayStart } }
  });
};

// ============ MARK / DELETE (user-side) ============

const findByIdAndUser = async (id, user_id) => {
  return await Notification.findOne({
    where: { id, user_id }
  });
};

const markAsRead = async (id, user_id) => {
  return await Notification.update(
    { is_read: true },
    { where: { id, user_id } }
  );
};

const markAllAsRead = async (user_id) => {
  return await Notification.update(
    { is_read: true },
    { where: { user_id, is_read: false } }
  );
};

const deleteByIdAndUser = async (id, user_id) => {
  return await Notification.destroy({
    where: { id, user_id }
  });
};

// ============ ADMIN QUERIES ============

// List all notifications with filters (admin) - subQuery:false kuepuka MySQL alias bug kwenye joins
const findAllAdmin = async ({ limit = 100, offset = 0, user_id = null, type = null, is_read = null, search = null } = {}) => {
  const where = {};

  if (user_id) where.user_id = user_id;
  if (type) where.type = type;
  if (is_read !== null && is_read !== undefined && is_read !== '') {
    where.is_read = is_read === true || is_read === 'true';
  }

  // Search kwa namba ya simu ya user (join-na-where kwenye User)
  const include = [{
    model: User,
    as: 'user',
    attributes: ['id', 'phone_number', 'balance', 'role'],
    required: true
  }];

  if (search) {
    include[0].where = {
      phone_number: { [Op.like]: `%${search}%` }
    };
  }

  const result = await Notification.findAndCountAll({
    where,
    include,
    limit: parseInt(limit, 10) || 100,
    offset: parseInt(offset, 10) || 0,
    order: [['createdAt', 'DESC']],
    distinct: true,
    subQuery: false
  });

  return result;
};

// Count notifications for admin stats
const countForStats = async (where = {}) => {
  return await Notification.count({ where });
};

module.exports = {
  createNotification,
  createMany,
  findUserNotifications,
  countUnread,
  countUnreadAll,
  countAll,
  findByIdAndUser,
  markAsRead,
  markAllAsRead,
  deleteByIdAndUser,
  findAllAdmin,
  countForStats,
  countCreatedToday
};