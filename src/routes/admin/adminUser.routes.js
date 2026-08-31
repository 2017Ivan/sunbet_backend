// routes/admin/adminUser.routes.js
// Mti wa "get all users" - wanaopatikana ADMIN pekee (sio /admin path)
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const adminUserController = require('../../controllers/admin/adminUser.controller');

// Orodha ya users wote (paginated + search)
router.get('/all', authenticate, authorize(['ADMIN']), adminUserController.getUsers);

// Tafuta kwa namba ya simu (lazima iwe KABLA ya /:id)
router.get('/phone/:phone', authenticate, authorize(['ADMIN']), adminUserController.getUserByPhone);

// Tafuta kwa user ID
router.get('/:id', authenticate, authorize(['ADMIN']), adminUserController.getUserById);

// Badilisha balance (action: set | add | deduct)
router.patch('/:id/balance', authenticate, authorize(['ADMIN']), adminUserController.adjustBalance);

// Futa user
router.delete('/:id', authenticate, authorize(['ADMIN']), adminUserController.deleteUser);

module.exports = router;