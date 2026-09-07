// routes/hero/hero.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const heroController = require('../../controllers/hero/hero.controller');

// Public - anyone can read hero slides
router.get('/slides', heroController.getSlides);

// Admin only - manage slides
router.post('/slides', authenticate, authorize(['ADMIN']), heroController.saveAllSlides);
router.post('/slides/reset', authenticate, authorize(['ADMIN']), heroController.resetAll);
router.put('/slides/:index', authenticate, authorize(['ADMIN']), heroController.saveSlide);
router.delete('/slides/:index', authenticate, authorize(['ADMIN']), heroController.clearSlide);

module.exports = router;
