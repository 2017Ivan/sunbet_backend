// routes/authController.routes.js 

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const authController = require('../../controllers/auth/auth.controller');

// Public
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', authController.changePasswordByPhone);

// Protected
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;