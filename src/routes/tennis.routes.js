const express = require('express');
const router = express.Router();
const tennisController = require('../controllers/tennis.controller');

// CRUD routes
router.post('/', tennisController.createTennisMatch);
router.get('/', tennisController.getAllTennisMatches);
router.get('/:id', tennisController.getTennisMatchById);
router.patch('/:id', tennisController.updateTennisMatch); // partial update
router.delete('/:id', tennisController.deleteTennisMatch);

module.exports = router;