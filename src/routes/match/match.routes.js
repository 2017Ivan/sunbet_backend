// routes/match/match.routes.js 
const express = require('express');
const router = express.Router();
const matchController = require('../../controllers/match/match.controller');

// Public endpoints
router.get('/upcoming', matchController.getUpcomingMatches);
router.get('/live', matchController.getLiveMatches); 
router.get('/:id', matchController.getMatchDetails);

// Management / Administrative endpoints
router.post('/', matchController.createMatch);
router.post('/bulk', matchController.createMultipleMatches);
router.post('/generate', matchController.generateMatches);
router.post('/upload', matchController.uploadMatchesFile);
router.patch('/:id/odds', matchController.updateMatchOdds);
router.patch('/:id/status', matchController.updateMatchStatus);

module.exports = router;