// src/routes/bet/bet.routes.js 
const express = require('express');
const router = express.Router();
const betController = require('../../controllers/bet/bet.controller'); 

// 1. Import authenticate middleware kutoka kwenye auth file yako
const { authenticate, authorize } = require('../../middleware/auth.middleware'); // Rekebisha path kama ni tofauti

// 2. Tumia authenticate middleware kulinda njia husika
router.post('/place', authenticate, betController.placeBet);

// ADMIN: bets zote (list-only) - search kwa namba ya simu ya user
router.get('/admin/all', authenticate, authorize(['ADMIN']), betController.getAllBets);

router.get('/my-bets', authenticate, betController.getUserBets);

// Njia ya kutafuta ticket inaweza kubaki public au kuwekewa authenticate ukitaka
router.get('/ticket/:ticketCode', betController.getBetByTicketCode);

// Cashout - kufunga mkeka mapema kwa kiasi kilichokadiriwa
router.post('/:id/cashout', authenticate, betController.cashoutBet);

// Win celebration - ushindi usioonekana bado (unajitokeza baada ya kuingia)
router.get('/win-notifications', authenticate, betController.getWinNotifications);

// Tambua (kthibitisha) ushindi wa mkeka ulioonekana kwenye celebration modal
router.post('/:id/acknowledge-win', authenticate, betController.acknowledgeWin);

module.exports = router;