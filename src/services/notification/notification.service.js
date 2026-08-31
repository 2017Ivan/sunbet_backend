// services/notification/notification.service.js

const userRepository = require('../../repositories/user/user.repository');
const notificationRepository = require('../../repositories/notification/notification.repository');
const deviceTokenRepository = require('../../repositories/device/deviceToken.repository');
const fcmService = require('../fcm/fcm.service');
const CustomExceptions = require('../../middleware/CustomExceptions');
const responseBuilder = require('../../utils/response.builder');

let io = null;
const initNotificationService = (socketIo) => {
  io = socketIo;
};

// Real-time push kwa user huyo (room: `user:<id>`) + FCM push (even if the
// app is closed). `notif` is the created Notification row when available.
const pushToUser = async (user_id, notif = null) => {
  if (io) {
    io.to(`user:${user_id}`).emit('new_notification');
  }

  if (!notif) return;

  try {
    const tokens = await deviceTokenRepository.findTokensByUserId(user_id);
    if (tokens.length === 0) return;

    const metadata = notif.metadata || {};
    await fcmService.pushToTokens(tokens, {
      title: notif.title,
      message: notif.message,
      data: {
        type: notif.type,
        notification_id: notif.id,
        title: notif.title,
        message: notif.message,
        ...(metadata.type ? { meta_type: metadata.type } : {}),
        ...(metadata.deposit_request_id
          ? { deposit_request_id: metadata.deposit_request_id }
          : {}),
      },
    });
  } catch (err) {
    console.error('FCM push error:', err.message);
  }
};

// ============ SEND (ADMIN) ============

// Send kwa mteja mmoja kwa namba ya simu
const sendToUser = async ({ phone_number, title, message, type = 'info', metadata = null }) => {
  if (!phone_number) throw new CustomExceptions('Phone number is required', 400);
  if (!message || !String(message).trim()) throw new CustomExceptions('Message is required', 400);

  const user = await userRepository.findByPhone(String(phone_number));
  if (!user) throw new CustomExceptions('User not found', 404);

  const notif = await notificationRepository.createNotification({
    user_id: user.id,
    type,
    title: title || 'Notification',
    message: String(message).trim(),
    metadata: metadata || null
  });

  pushToUser(user.id, notif);

  return responseBuilder.success({
    status: 201,
    message: 'Notification sent successfully',
    data: {
      notification: {
        id: notif.id,
        user_id: notif.user_id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        is_read: notif.is_read,
        created_at: notif.createdAt
      }
    }
  });
};

// Send kwa wateja wengi (namba nyingi)
const sendToMultiple = async ({ phone_numbers = [], title, message, type = 'info', metadata = null }) => {
  if (!Array.isArray(phone_numbers) || phone_numbers.length === 0) {
    throw new CustomExceptions('At least one phone number is required', 400);
  }
  if (!message || !String(message).trim()) throw new CustomExceptions('Message is required', 400);

  const users = [];
  for (const phone of phone_numbers) {
    const user = await userRepository.findByPhone(String(phone));
    if (user) users.push(user);
  }

  if (users.length === 0) throw new CustomExceptions('No matching users found', 404);

  const created = await notificationRepository.createMany(
    users.map((u) => ({
      user_id: u.id,
      type,
      title: title || 'Notification',
      message: String(message).trim(),
      metadata: metadata || null
    }))
  );

  users.forEach((u, i) => pushToUser(u.id, created ? created[i] : null));

  return responseBuilder.success({
    status: 201,
    message: 'Notifications sent successfully',
    data: {
      sent: created.length
    }
  });
};

// Broadcast kwa wateja WOTE (USER role)
const sendToAll = async ({ title, message, type = 'info', metadata = null }) => {
  if (!message || !String(message).trim()) throw new CustomExceptions('Message is required', 400);

  const allUsers = await userRepository.findAllUserIds();
  if (!allUsers || allUsers.length === 0) throw new CustomExceptions('No customers found', 404);

  const CHUNK = 1000;
  const notifications = allUsers.map((u) => ({
    user_id: u.id,
    type,
    title: title || 'Notification',
    message: String(message).trim(),
    metadata: metadata || null
  }));

  let sent = 0;
  for (let i = 0; i < notifications.length; i += CHUNK) {
    const chunk = notifications.slice(i, i + CHUNK);
    await notificationRepository.createMany(chunk);
    sent += chunk.length;
    chunk.forEach((n) => pushToUser(n.user_id, n));
  }

  return responseBuilder.success({
    status: 201,
    message: 'Notification sent to all customers',
    data: {
      sent,
      broadcast: true
    }
  });
};

// ============ USER SIDE ============

const getMyNotifications = async ({ user_id, limit = 50, offset = 0, unreadOnly = false }) => {
  const result = await notificationRepository.findUserNotifications({
    user_id,
    limit,
    offset,
    unreadOnly: unreadOnly === true || unreadOnly === 'true'
  });

  const notifications = result.rows.map((n) => {
    const json = n.toJSON ? n.toJSON() : n;
    return {
      id: json.id,
      type: json.type,
      title: json.title,
      message: json.message,
      is_read: json.is_read,
      metadata: json.metadata || null,
      created_at: json.createdAt
    };
  });

  const unreadCount = await notificationRepository.countUnread(user_id);

  return responseBuilder.success({
    status: 200,
    message: 'My notifications',
    data: {
      notifications,
      total: result.count,
      unread_count: unreadCount
    }
  });
};

const getMyUnreadCount = async ({ user_id }) => {
  const unreadCount = await notificationRepository.countUnread(user_id);
  return responseBuilder.success({
    status: 200,
    message: 'Unread count',
    data: { unread_count: unreadCount }
  });
};

const markOneRead = async ({ id, user_id }) => {
  const notif = await notificationRepository.findByIdAndUser(id, user_id);
  if (!notif) throw new CustomExceptions('Notification not found', 404);
  await notificationRepository.markAsRead(id, user_id);
  return responseBuilder.success({ status: 200, message: 'Marked as read', data: { id } });
};

const markAllRead = async ({ user_id }) => {
  const updated = await notificationRepository.markAllAsRead(user_id);
  return responseBuilder.success({
    status: 200,
    message: 'All notifications marked as read',
    data: { updated: updated[0] || 0 }
  });
};

const deleteOne = async ({ id, user_id }) => {
  const deleted = await notificationRepository.deleteByIdAndUser(id, user_id);
  if (!deleted) throw new CustomExceptions('Notification not found', 404);
  return responseBuilder.success({ status: 200, message: 'Notification deleted', data: { deleted } });
};

// ============ ADMIN QUERIES ============

const getAllAdmin = async ({ limit = 100, offset = 0, user_id = null, type = null, is_read = null, search = null } = {}) => {
  const result = await notificationRepository.findAllAdmin({ limit, offset, user_id, type, is_read, search });

  const notifications = result.rows.map((n) => {
    const json = n.toJSON ? n.toJSON() : n;
    return {
      id: json.id,
      type: json.type,
      title: json.title,
      message: json.message,
      is_read: json.is_read,
      metadata: json.metadata || null,
      created_at: json.createdAt,
      phone_number: json.user?.phone_number || null,
      user_id: json.user_id
    };
  });

  return responseBuilder.success({
    status: 200,
    message: 'All notifications',
    data: {
      notifications,
      total: result.count
    }
  });
};

// Notifications za user mmoja kwa namba ya simu (admin)
const getByPhone = async ({ phone_number, limit = 50 }) => {
  const user = await userRepository.findByPhone(String(phone_number));
  if (!user) throw new CustomExceptions('User not found', 404);

  const result = await notificationRepository.findUserNotifications({
    user_id: user.id,
    limit,
    offset: 0,
    unreadOnly: false
  });

  return responseBuilder.success({
    status: 200,
    message: 'User notifications',
    data: {
      notifications: result.rows.map((n) => {
        const json = n.toJSON ? n.toJSON() : n;
        return {
          id: json.id,
          type: json.type,
          title: json.title,
          message: json.message,
          is_read: json.is_read,
          created_at: json.createdAt
        };
      }),
      total: result.count,
      phone_number: user.phone_number
    }
  });
};

const getUserUnreadByPhone = async ({ phone_number }) => {
  const user = await userRepository.findByPhone(String(phone_number));
  if (!user) throw new CustomExceptions('User not found', 404);
  const unreadCount = await notificationRepository.countUnread(user.id);
  return responseBuilder.success({
    status: 200,
    message: 'User unread count',
    data: { phone_number: user.phone_number, unread_count: unreadCount }
  });
};

// Angalia kama user yupo kwa namba (search/choose)
const checkUser = async ({ phone_number }) => {
  const user = await userRepository.findByPhone(String(phone_number));
  if (!user) throw new CustomExceptions('User not found', 404);
  return responseBuilder.success({
    status: 200,
    message: 'User found',
    data: {
      user: {
        id: user.id,
        phone_number: user.phone_number,
        balance: user.balance ? String(user.balance) : '0',
        role: user.role
      }
    }
  });
};

module.exports = {
  initNotificationService,
  sendToUser,
  sendToMultiple,
  sendToAll,
  getMyNotifications,
  getMyUnreadCount,
  markOneRead,
  markAllRead,
  deleteOne,
  getAllAdmin,
  getByPhone,
  getUserUnreadByPhone,
  checkUser
};