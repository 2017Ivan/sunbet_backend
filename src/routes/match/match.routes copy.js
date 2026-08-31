
// routes/match/match.routes.js 
const express = require('express');
const router = express.Router();
const matchController = require('../../controllers/match/match.controller');

router.get('/upcoming', matchController.getUpcomingMatches);
router.get('/:id', matchController.getMatchDetails);


router.post('/',  matchController.createMatch);
router.patch('/:id/odds',  matchController.updateMatchOdds);
router.patch('/:id/status', matchController.updateMatchStatus);

module.exports = router;