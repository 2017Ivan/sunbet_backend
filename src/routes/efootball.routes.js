const express = require('express');
const router = express.Router();
const efootballController = require('../controllers/efootball.controller');

// CRUD routes
router.post('/', efootballController.createEfootballMatch);
router.get('/', efootballController.getAllEfootballMatches);
router.get('/:id', efootballController.getEfootballMatchById);
router.patch('/:id', efootballController.updateEfootballMatch); // partial update
router.delete('/:id', efootballController.deleteEfootballMatch);

module.exports = router;