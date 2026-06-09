const express = require('express');
const router = express.Router();
const liveController = require('../controllers/live.controller');

// CRUD routes
router.post('/', liveController.createLiveMatch);
router.get('/', liveController.getAllLiveMatches);
router.get('/:id', liveController.getLiveMatchById);
router.patch('/:id', liveController.updateLiveMatch); // partial update
router.delete('/:id', liveController.deleteLiveMatch);

module.exports = router;