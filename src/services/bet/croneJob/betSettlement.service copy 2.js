// services/bet/betSettlement.service.js

const { sequelize } = require('../../../models');
const userRepository = require('../../../repositories/user/user.repository');
const betRepository = require('../../../repositories/bet/bet.repository');

const evaluateSelection = (selection, match) => {
  const { market_key, outcome_key } = selection;
  const script = match.predetermined_script;
  const ft = script.final_ft;
  
  const home = ft.homeScore;
  const away = ft.awayScore;
  const totalGoals = home + away;

  switch (market_key) {
    case '1X2':
      if (outcome_key === '1') return home > away;
      if (outcome_key === '2') return away > home;
      if (outcome_key === 'X') return home === away;
      break;

    case 'Double_Chance':
      if (outcome_key === '1X') return home >= away;
      if (outcome_key === 'X2') return away >= home;
      if (outcome_key === '12') return home !== away;
      break;

    case 'BTTS':
      const bothScored = home > 0 && away > 0;
      return outcome_key === 'Yes' ? bothScored : !bothScored;

    case 'Correct_Score':
      const exactScore = `${home}-${away}`;
      return outcome_key === exactScore;

    case 'Over_Under':
      const [type, thresholdStr] = outcome_key.split('_'); 
      const threshold = parseFloat(thresholdStr);
      return type === 'OVER' ? totalGoals > threshold : totalGoals < threshold;

    default:
      return false;
  }
  return false;
};

// ============ FIX: Badilisha 'Selections' kuwa 'selections' ============
const checkAllMatchesFinished = (bet) => {
  // Badilisha hapa - 'selections' (small s) sio 'Selections'
  const selections = bet.selections || [];
  
  for (const sel of selections) {
    // Badilisha hapa - 'match' (small m) sio 'Match'
    const match = sel.match;
    if (!match || match.status !== 'FINISHED') {
      return false;
    }
  }
  return true;
};

// ============ FIX: Badilisha 'Selections' kuwa 'selections' ============
const checkAllSelectionsWon = (bet) => {
  const selections = bet.selections || [];
  
  for (const sel of selections) {
    if (sel.status !== 'WON') {
      return false;
    }
  }
  return true;
};

// ============ FIX: Badilisha 'Selections' kuwa 'selections' ============
const checkAnySelectionLost = (bet) => {
  const selections = bet.selections || [];
  
  for (const sel of selections) {
    if (sel.status === 'LOST') {
      return true;
    }
  }
  return false;
};

// ============ FIX: Main settlement function ============
const settlePendingBets = async (finishedMatchId) => {
  console.log(`[SETTLEMENT] 🚀 Starting settlement for match ${finishedMatchId}`);
  
  try {
    // Tafuta mikeka yote PENDING yenye hii mechi
    const pendingBets = await betRepository.findPendingBetsByMatchId(finishedMatchId);
    
    if (!pendingBets || pendingBets.length === 0) {
      console.log(`[SETTLEMENT] ℹ️ No pending bets found for match ${finishedMatchId}`);
      return;
    }

    console.log(`[SETTLEMENT] 📋 Found ${pendingBets.length} pending bets`);

    for (const bet of pendingBets) {
      console.log(`[SETTLEMENT] 🔄 Processing bet ${bet.ticket_code}`);
      
      const transaction = await sequelize.transaction();
      
      try {
        // ============ FIX: Use 'selections' (small s) ============
        const selections = bet.selections || [];
        console.log(`[SETTLEMENT] 📊 Bet has ${selections.length} selections`);

        // Evaluate all selections for this match
        for (const sel of selections) {
          if (sel.status === 'PENDING') {
            // ============ FIX: Use 'match' (small m) ============
            const match = sel.match;
            
            if (!match) {
              console.log(`[SETTLEMENT] ⚠️ No match for selection ${sel.id}`);
              continue;
            }
            
            console.log(`[SETTLEMENT] 🔍 Selection: ${sel.market_key} - ${sel.outcome_key} | Match: ${match.status}`);
            
            // Only evaluate if match is FINISHED
            if (match.status === 'FINISHED') {
              const isWon = evaluateSelection(sel, match);
              const newStatus = isWon ? 'WON' : 'LOST';
              
              console.log(`[SETTLEMENT] ${isWon ? '✅' : '❌'} Selection -> ${newStatus}`);
              
              // ============ FIX: Use update() instead of save() ============
              await sel.update({ status: newStatus }, { transaction });
            }
          }
        }

        // Check if all matches in this bet are finished
        const allMatchesFinished = checkAllMatchesFinished(bet);
        console.log(`[SETTLEMENT] 📊 All matches finished: ${allMatchesFinished}`);
        
        if (allMatchesFinished) {
          // All matches are finished, now determine final result
          const hasLostSelection = checkAnySelectionLost(bet);
          const allSelectionsWon = checkAllSelectionsWon(bet);
          
          console.log(`[SETTLEMENT] 📊 Has lost: ${hasLostSelection}, All won: ${allSelectionsWon}`);
          
          // Update Bet Status and Result
          if (hasLostSelection) {
            console.log(`[SETTLEMENT] ❌ Bet ${bet.ticket_code} LOST`);
            // ============ FIX: Use update() instead of save() ============
            await bet.update({
              status: 'SETTLED',
              result: 'LOST'
            }, { transaction });
            
          } else if (allSelectionsWon) {
            console.log(`[SETTLEMENT] ✅ Bet ${bet.ticket_code} WON`);
            
            // ============ FIX: Use update() instead of save() ============
            await bet.update({
              status: 'SETTLED',
              result: 'WON'
            }, { transaction });

            // Lipa hela ya ushindi kwenye Wallet ya User!
            const payoutAmount = parseFloat(bet.payout);
            if (payoutAmount > 0) {
              console.log(`[SETTLEMENT] 💰 Paying ${payoutAmount} to user ${bet.user_id}`);
              await userRepository.deposit(bet.user_id, payoutAmount, transaction);
            }
          } else {
            console.log(`[SETTLEMENT] ⚠️ Bet ${bet.ticket_code} has mixed statuses - setting as LOST`);
            await bet.update({
              status: 'SETTLED',
              result: 'LOST'
            }, { transaction });
          }
        } else {
          console.log(`[SETTLEMENT] ⏳ Bet ${bet.ticket_code} still has pending matches`);
        }

        await transaction.commit();
        console.log(`[SETTLEMENT] ✅ Bet ${bet.ticket_code} processed`);
        
      } catch (error) {
        await transaction.rollback();
        console.error(`[SETTLEMENT] ❌ Error settling bet ${bet.id}:`, error);
      }
    }
    
    console.log(`[SETTLEMENT] ✅ Settlement completed for match ${finishedMatchId}`);
    
  } catch (error) {
    console.error(`[SETTLEMENT] ❌ Fatal error:`, error);
  }
};

// ============ FIX: settleSpecificBet pia ============
const settleSpecificBet = async (betId) => {
  console.log(`[SETTLEMENT] 🔧 Force settling bet ${betId}`);
  
  const bet = await betRepository.findBetById(betId);
  if (!bet) {
    throw new Error('Bet not found');
  }

  const transaction = await sequelize.transaction();
  
  try {
    // ============ FIX: Use 'selections' (small s) ============
    const selections = bet.selections || [];
    
    // Evaluate all selections
    for (const sel of selections) {
      if (sel.status === 'PENDING') {
        // ============ FIX: Use 'match' (small m) ============
        const match = sel.match;
        if (match && match.status === 'FINISHED') {
          const isWon = evaluateSelection(sel, match);
          await sel.update({ 
            status: isWon ? 'WON' : 'LOST' 
          }, { transaction });
        }
      }
    }

    // Determine bet result
    const allMatchesFinished = checkAllMatchesFinished(bet);
    
    if (allMatchesFinished) {
      const hasLostSelection = checkAnySelectionLost(bet);
      const allSelectionsWon = checkAllSelectionsWon(bet);
      
      if (hasLostSelection) {
        await bet.update({
          status: 'SETTLED',
          result: 'LOST'
        }, { transaction });
      } else if (allSelectionsWon) {
        await bet.update({
          status: 'SETTLED',
          result: 'WON'
        }, { transaction });
        
        const payoutAmount = parseFloat(bet.payout);
        if (payoutAmount > 0) {
          await userRepository.deposit(bet.user_id, payoutAmount, transaction);
        }
      } else {
        await bet.update({
          status: 'SETTLED',
          result: 'LOST'
        }, { transaction });
      }
    }

    await transaction.commit();
    
    const finalBet = await betRepository.findBetById(betId);
    return finalBet;
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = { 
  settlePendingBets,
  settleSpecificBet,
  evaluateSelection,
  checkAllMatchesFinished,
  checkAllSelectionsWon,
  checkAnySelectionLost
};