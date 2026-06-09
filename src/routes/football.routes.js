const express = require('express');
const router = express.Router();
const footballController = require('../controllers/football.controller');

// CRUD routes
router.post('/', footballController.createFootballMatch);
router.get('/', footballController.getAllFootballMatches);
router.get('/:id', footballController.getFootballMatchById);
router.patch('/:id', footballController.updateFootballMatch); // partial update
router.delete('/:id', footballController.deleteFootballMatch);

module.exports = router;