// src/repositories/bet/bet.repository.js

const { Bet, BetSelection, Match } = require('../../models');
const { sequelize } = require('../../models');

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

// ============ FIND PENDING BETS BY MATCH ID ============
const findPendingBetsByMatchId = async (matchId) => {
  console.log(`[REPO] Finding pending bets for match ${matchId}`);
  
  try {
    const bets = await Bet.findAll({
      where: { 
        status: 'PENDING'
      },
      include: [{
        model: BetSelection,
        as: 'selections',
        where: { match_id: matchId },
        required: true,
        include: [{
          model: Match,
          as: 'match',
          attributes: MATCH_PUBLIC_ATTRIBUTES
        }]
      }]
    });
    
    console.log(`[REPO] Found ${bets.length} pending bets for match ${matchId}`);
    
    // Debug: Log bet details
    bets.forEach(bet => {
      console.log(`  - Bet ${bet.ticket_code}: ${bet.selections?.length || 0} selections`);
      bet.selections?.forEach(sel => {
        console.log(`    - Selection ${sel.id}: ${sel.market_key} - ${sel.outcome_key} (${sel.status})`);
      });
    });
    
    return bets;
  } catch (error) {
    console.error(`[REPO] Error finding pending bets:`, error);
    return [];
  }
};

// ============ FIND ALL PENDING BETS ============
const findAllPendingBets = async () => {
  console.log(`[REPO] Finding all pending bets`);
  
  try {
    const bets = await Bet.findAll({
      where: { 
        status: 'PENDING'
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
    
    console.log(`[REPO] Found ${bets.length} total pending bets`);
    return bets;
  } catch (error) {
    console.error(`[REPO] Error finding all pending bets:`, error);
    return [];
  }
};

// ============ FIND PENDING BETS BY USER ID ============
const findPendingBetsByUserId = async (userId) => {
  console.log(`[REPO] Finding pending bets for user ${userId}`);
  
  try {
    const bets = await Bet.findAll({
      where: { 
        user_id: userId,
        status: 'PENDING'
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
    
    console.log(`[REPO] Found ${bets.length} pending bets for user ${userId}`);
    return bets;
  } catch (error) {
    console.error(`[REPO] Error finding pending bets for user:`, error);
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

module.exports = {
  // Main CRUD
  createBet,
  findBetById,
  findBetByTicketCode,
  findBetsByUserId,
  
  // Updates
  updateBetStatus,
  updateBetStatusAndResult,
  updateBetSelectionStatus,
  updateBetWithTransaction,
  updateSelectionWithTransaction,
  bulkUpdateSelections,
  
  // Find by match
  findPendingBetsByMatchId,
  findAllPendingBets,
  findPendingBetsByUserId,
  findBetWithSelectionsAndMatches,
  
  // Counts
  getBetCountByStatus,
  getBetCountByUserAndStatus
};