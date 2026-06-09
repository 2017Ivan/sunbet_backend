const express = require('express');
const router = express.Router();
const basketballController = require('../controllers/basketball.controller');

// CRUD routes
router.post('/', basketballController.createBasketballMatch);
router.get('/', basketballController.getAllBasketballMatches);
router.get('/:id', basketballController.getBasketballMatchById);
router.patch('/:id', basketballController.updateBasketballMatch); // partial update
router.delete('/:id', basketballController.deleteBasketballMatch);

module.exports = router;