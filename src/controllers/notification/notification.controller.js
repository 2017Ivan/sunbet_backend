// controllers/notification/notification.controller.js
const notificationService = require('../../services/notification/notification.service');

// ============ SEND (ADMIN) ============
const sendToUser = async (req, res, next) => {
  try {
    const { phone_number, title, message, type, metadata } = req.body;
    const result = await notificationService.sendToUser({ phone_number, title, message, type, metadata });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const sendToMultiple = async (req, res, next) => {
  try {
    const { phone_numbers, title, message, type, metadata } = req.body;
    const result = await notificationService.sendToMultiple({ phone_numbers, title, message, type, metadata });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const sendToAll = async (req, res, next) => {
  try {
    const { title, message, type, metadata } = req.body;
    const result = await notificationService.sendToAll({ title, message, type, metadata });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// ============ USER SIDE ============
const getMyNotifications = async (req, res, next) => {
  try {
    const { limit, offset, unreadOnly } = req.query;
    const result = await notificationService.getMyNotifications({
      user_id: req.user.id,
      limit,
      offset,
      unreadOnly
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getMyUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getMyUnreadCount({ user_id: req.user.id });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const markOneRead = async (req, res, next) => {
  try {
    const result = await notificationService.markOneRead({
      id: req.params.id,
      user_id: req.user.id
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead({ user_id: req.user.id });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const deleteOne = async (req, res, next) => {
  try {
    const result = await notificationService.deleteOne({
      id: req.params.id,
      user_id: req.user.id
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ============ ADMIN QUERIES ============
const getAllAdmin = async (req, res, next) => {
  try {
    const { limit, offset, user_id, type, is_read, search } = req.query;
    const result = await notificationService.getAllAdmin({ limit, offset, user_id, type, is_read, search });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getByPhone = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const result = await notificationService.getByPhone({
      phone_number: req.params.phone,
      limit
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getUserUnreadByPhone = async (req, res, next) => {
  try {
    const result = await notificationService.getUserUnreadByPhone({ phone_number: req.params.phone });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const checkUser = async (req, res, next) => {
  try {
    const result = await notificationService.checkUser({ phone_number: req.params.phone });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
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