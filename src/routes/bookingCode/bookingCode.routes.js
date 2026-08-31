// routes/bookingCode/bookingCode.routes.js 

const express = require('express');
const router = express.Router();
const bookingCodeController = require('../../controllers/bookingCode/bookingCode.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ADMIN: booking codes zote (list-only) - search kwa code wenyewe, status filter
// (IMPORTANT: inabidi iwe KABLA ya '/:code' ili isigongane na 'admin' kama code)
router.get('/admin', authenticate, authorize(['ADMIN']), bookingCodeController.getAllBookingCodes);

// 1. Kutengeneza Booking Code Mpya
router.post('/create',  bookingCodeController.createBookingCode);

// 2. Kuangalia/Kufungua Taarifa za Booking Code kupitia kodi yake (Mfano: BC-8X92A)
router.get('/:code', bookingCodeController.getBookingCodeDetails);

module.exports = router;