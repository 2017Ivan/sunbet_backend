// routes/users.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const userController = require('../../controllers/user Management/user.controller');

// ── All admin routes require authentication and ADMIN role ────────────────
router.use(authenticate);
router.use(authorize('ADMIN'));

// ── USER MANAGEMENT ROUTES ─────────────────────────────────────────────────

/**
 * GET /api/admin/users - Get all users
 * Query: ?search=xxx&limit=50&offset=0
 */
router.get('/users', userController.adminGetAllUsers);

/**
 * GET /api/admin/users/:id - Get user by ID
 */
router.get('/users/:id', userController.adminGetUserById);

/**
 * GET /api/admin/users/phone/:phone - Get user by phone number
 * Example: /api/admin/users/phone/255683307420
 */
router.get('/users/phone/:phone', userController.adminGetUserByPhone);

/**
 * PATCH /api/admin/users/:id/balance - Adjust user balance
 * Body: { "action": "add", "amount": 10000 }
 * action: add, deduct, set
 */
router.patch('/users/:id/balance', userController.adminAdjustBalance);

/**
 * DELETE /api/admin/users/:id - Delete user
 */
router.delete('/users/:id', userController.adminDeleteUser);

module.exports = router;