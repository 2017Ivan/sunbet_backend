// src/repositories/bet/bet.repository.js

const { Bet, BetSelection, Match, User } = require('../../models');
const { sequelize } = require('../../models');
const { Op } = require('sequelize');

// Constant ya attributes tunazozitaka pekee kutoka kwenye Match
const MATCH_PUBLIC_ATTRIBUTES = [
  'id',
  'match_code',
  'home_team',
  'away_team',
  'league',
  'date',
  'time',
  'status',
  'current_score',
  'predetermined_script'
];

// ============ FIND BET BY ID ============
const findBetById = async (id, transaction = null) => {
  return await Bet.findByPk(id, {
    include: [
      {
        model: BetSelection,
        as: 'selections',
        include: [
          {
            model: Match,
            as: 'match',
            attributes: MATCH_PUBLIC_ATTRIBUTES
          }
        ]
      }
    ],
    transaction
  });
};

// ============ FIND BET WITH SELECTIONS AND MATCHES ============
const findBetWithSelectionsAndMatches = async (betId) => {
  return await Bet.findByPk(betId, {
    include: [
      {
        model: BetSelection,
        as: 'selections',
        include: [
          {
            model: Match,
            as: 'match',
            attributes: MATCH_PUBLIC_ATTRIBUTES
          }
        ]
      }
    ]
  });
};

// ============ CREATE BET ============
const createBet = async (betData, selectionsData, transaction = null) => {
  const bet = await Bet.create(betData, { transaction });

  const selectionsWithBetId = selectionsData.map(item => ({
    ...item,
    bet_id: bet.id
  }));

  await BetSelection.bulkCreate(selectionsWithBetId, { transaction });

  return await findBetById(bet.id, transaction);
};

// ============ FIND BET BY TICKET CODE ============
const findBetByTicketCode = async (ticketCode) => {
  return await Bet.findOne({
    where: { ticket_code: ticketCode },
    include: [
      {
        model: BetSelection,
        as: 'selections',
        include: [
          {
            model: Match,
            as: 'match',
            attributes: MATCH_PUBLIC_ATTRIBUTES
          }
        ]
      }
    ]
  });
};

// ============ FIND BETS BY USER ID ============
const findBetsByUserId = async (userId, options = {}) => {
  return await Bet.findAll({
    where: { user_id: userId },
    include: [
      {
        model: BetSelection,
        as: 'selections',
        include: [
          {
            model: Match,
            as: 'match',
            attributes: MATCH_PUBLIC_ATTRIBUTES
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']],
    ...options
  });
};

// ============ ADMIN: BETS ZOTE (na tafuta kwa namba ya simu ya user) ============
// "just list bets all" - admin anaweza kufetch bets za user yeyote kwa kuingiza
// namba yake ya simu. Hakuna uhariri/settlement hapa.

// eslint-disable-next-line no-unused-vars
const findAllBetsAdmin = async ({
  search = '',
  limit = 50,
  offset = 0
} = {}) => {
  const where = {};

  if (search) {
    where['$user.phone_number$'] = { [Op.like]: `%${search}%` };
  }

  const intLimit = parseInt(limit, 10) || 50;
  const intOffset = parseInt(offset, 10) || 0;

  return await Bet.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'phone_number', 'role', 'status']
      },
      {
        model: BetSelection,
        as: 'selections',
        include: [
          {
            model: Match,
            as: 'match',
            attributes: MATCH_PUBLIC_ATTRIBUTES
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: intLimit,
    offset: intOffset,
    distinct: true,
    subQuery: false
  });
};

// ============ UPDATE BET STATUS ============
const updateBetStatus = async (betId, status, transaction = null) => {
  const [updatedRows] = await Bet.update(
    { status },
    { where: { id: betId }, transaction }
  );
  return updatedRows > 0;
};

// ============ UPDATE BET STATUS AND RESULT ============
const updateBetStatusAndResult = async (betId, status, result, transaction = null) => {
  const [updatedRows] = await Bet.update(
    { 
      status: status,
      result: result
    },
    { where: { id: betId }, transaction }
  );
  return updatedRows > 0;
};

// ============ UPDATE BET SELECTION STATUS ============
const updateBetSelectionStatus = async (selectionId, status, transaction = null) => {
  const [updatedRows] = await BetSelection.update(
    { status },
    { where: { id: selectionId }, transaction }
  );
  return updatedRows > 0;
};

// ============ FIND OPEN BETS BY MATCH ID (Bado hazijasettled) ============
const findOpenBetsByMatchId = async (matchId) => {
  console.log(`[REPO] Finding open bets for match ${matchId}`);
  
  try {
    // 1) Leta bet_ids zote (OPEN) ambazo zina selection ya match hii
    const selectionsForMatch = await BetSelection.findAll({
      where: { match_id: matchId },
      attributes: ['bet_id'],
      raw: true
    });

    const betIds = [...new Set((selectionsForMatch || []).map(s => s.bet_id))];

    if (betIds.length === 0) {
      console.log(`[REPO] Found 0 open bets for match ${matchId}`);
      return [];
    }

    // 2) Leta bets hizo NA selections zake ZOTE  (sio match moja tu!)
    //    Hii ni muhimu: mkeka (accumulator) unajumlisha mechi nyingi,
    //    hatuwezi ku-settle hadi mechi zote za mkeka zimekamilika.
    const bets = await Bet.findAll({
      where: {
        id: { [Op.in]: betIds },
        status: 'OPEN'
      },
      include: [{
        model: BetSelection,
        as: 'selections',
        include: [{
          model: Match,
          as: 'match',
          attributes: MATCH_PUBLIC_ATTRIBUTES
        }]
      }]
    });
    
    console.log(`[REPO] Found ${bets.length} open bets for match ${matchId}`);
    
    bets.forEach(bet => {
      console.log(`  - Bet ${bet.ticket_code}: ${bet.selections?.length || 0} selections`);
      bet.selections?.forEach(sel => {
        console.log(`    - Selection ${sel.id}: ${sel.market_key} - ${sel.outcome_key} (${sel.status})`);
      });
    });
    
    return bets;
  } catch (error) {
    console.error(`[REPO] Error finding open bets:`, error);
    return [];
  }
};

// ============ FIND ALL OPEN BETS ============
const findAllOpenBets = async () => {
  console.log(`[REPO] Finding all open bets`);
  
  try {
    const bets = await Bet.findAll({
      where: { 
        status: 'OPEN'  // ← Badilisha kutoka 'PENDING' kuwa 'OPEN'
      },
      include: [{
        model: BetSelection,
        as: 'selections',
        include: [{
          model: Match,
          as: 'match',
          attributes: MATCH_PUBLIC_ATTRIBUTES
        }]
      }]
    });
    
    console.log(`[REPO] Found ${bets.length} total open bets`);
    return bets;
  } catch (error) {
    console.error(`[REPO] Error finding all open bets:`, error);
    return [];
  }
};

// ============ FIND OPEN BETS BY USER ID ============
const findOpenBetsByUserId = async (userId) => {
  console.log(`[REPO] Finding open bets for user ${userId}`);
  
  try {
    const bets = await Bet.findAll({
      where: { 
        user_id: userId,
        status: 'OPEN'  // ← Badilisha kutoka 'PENDING' kuwa 'OPEN'
      },
      include: [{
        model: BetSelection,
        as: 'selections',
        include: [{
          model: Match,
          as: 'match',
          attributes: MATCH_PUBLIC_ATTRIBUTES
        }]
      }],
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`[REPO] Found ${bets.length} open bets for user ${userId}`);
    return bets;
  } catch (error) {
    console.error(`[REPO] Error finding open bets for user:`, error);
    return [];
  }
};

// ============ UPDATE BET WITH TRANSACTION ============
const updateBetWithTransaction = async (betId, updateData, transaction) => {
  const [updatedRows] = await Bet.update(
    updateData,
    { where: { id: betId }, transaction }
  );
  return updatedRows > 0;
};

// ============ UPDATE SELECTION WITH TRANSACTION ============
const updateSelectionWithTransaction = async (selectionId, updateData, transaction) => {
  const [updatedRows] = await BetSelection.update(
    updateData,
    { where: { id: selectionId }, transaction }
  );
  return updatedRows > 0;
};

// ============ BULK UPDATE SELECTIONS ============
const bulkUpdateSelections = async (selectionsData, transaction = null) => {
  const promises = selectionsData.map(({ id, status }) => {
    return BetSelection.update(
      { status },
      { where: { id }, transaction }
    );
  });
  
  const results = await Promise.all(promises);
  return results.every(result => result[0] > 0);
};

// ============ GET BET COUNT BY STATUS ============
const getBetCountByStatus = async (status) => {
  return await Bet.count({
    where: { status }
  });
};

// ============ GET BET COUNT BY USER AND STATUS ============
const getBetCountByUserAndStatus = async (userId, status) => {
  return await Bet.count({
    where: { 
      user_id: userId,
      status 
    }
  });
};

// ============ FIND UNACKNOWLEDGED WINS BY USER ID ============
const findUnacknowledgedWins = async (userId, transaction = null) => {
  return await Bet.findAll({
    where: {
      user_id: userId,
      status: 'SETTLED',
      result: 'WON',
      win_acknowledged: false
    },
    include: [
      {
        model: BetSelection,
        as: 'selections',
        include: [
          {
            model: Match,
            as: 'match',
            attributes: MATCH_PUBLIC_ATTRIBUTES
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']],
    transaction
  });
};

// ============ MARK BET'S WIN AS ACKNOWLEDGED ============
 const markWinAsAcknowledged = async (betId, transaction = null) => {
   const [updatedRows] = await Bet.update(
     { win_acknowledged: true },
     { where: { id: betId }, transaction }
   );
   return updatedRows > 0;
 };

 // ============ DASHBOARD STATS ============
 const getBetStats = async (dayStart) => {
   const whereToday = dayStart ? { createdAt: { [Op.gte]: dayStart } } : {};

   const [betsToday, revenueToday, payoutsToday, openBets, totalBets, wonBets] = await Promise.all([
     Bet.count({ where: whereToday }),
     Bet.sum('stake', { where: whereToday }),
     Bet.sum('payout', { where: { result: 'WON', updatedAt: dayStart ? { [Op.gte]: dayStart } : {} } }),
     Bet.count({ where: { status: 'OPEN' } }),
     Bet.count(),
     Bet.count({ where: { result: 'WON' } })
   ]);

   return {
     betsToday: betsToday || 0,
     revenueToday: revenueToday || 0,
     payoutsToday: payoutsToday || 0,
     openBets: openBets || 0,
     totalBets: totalBets || 0,
     wonBets: wonBets || 0
   };
 };

 // Recent bets (latest) - admin dashboard
 const findRecentBetsAdmin = async (limit = 10) => {
   return await Bet.findAll({
     include: [{
       model: User,
       as: 'user',
       attributes: ['id', 'phone_number'],
       required: true
     }],
     limit: parseInt(limit, 10) || 10,
     order: [['createdAt', 'DESC']],
     distinct: true,
     subQuery: false
   });
 };

module.exports = {
  // Main CRUD
  createBet,
  findBetById,
  findBetByTicketCode,
  findBetsByUserId,
  findAllBetsAdmin,
  
  // Updates
  updateBetStatus,
  updateBetStatusAndResult,
  updateBetSelectionStatus,
  updateBetWithTransaction,
  updateSelectionWithTransaction,
  bulkUpdateSelections,
  
  // Find by match - OPEN bets (ziko 'OPEN' na bado hazijasettled)
  findOpenBetsByMatchId,        // ← Jina jipya
  findAllOpenBets,             // ← Jina jipya
  findOpenBetsByUserId,        // ← Jina jipya
  findBetWithSelectionsAndMatches,
  findUnacknowledgedWins,
  markWinAsAcknowledged,
  
  // Counts
  getBetCountByStatus,
  getBetCountByUserAndStatus,

  // Dashboard
  getBetStats,
  findRecentBetsAdmin
};