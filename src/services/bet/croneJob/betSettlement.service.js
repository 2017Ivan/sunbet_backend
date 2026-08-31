// services/bet/betSettlement.service.js

const { sequelize } = require('../../../models');
const userRepository = require('../../../repositories/user/user.repository');
const betRepository = require('../../../repositories/bet/bet.repository');
const notificationService = require('../../notification/notification.service');

// ============ EVALUATE SELECTION (MASOKO YOTE) ============
const evaluateSelection = (selection, match) => {
  const { market_key, outcome_key } = selection;
  const script = match.predetermined_script || {};

  // Extraction ya Takwimu kutoka kwenye Script
  const ftHome = script?.final_ft?.homeScore ?? 0;
  const ftAway = script?.final_ft?.awayScore ?? 0;
  const totalGoals = ftHome + ftAway;

  const htHome = script?.final_ht?.homeScore ?? 0;
  const htAway = script?.final_ht?.awayScore ?? 0;

  const shHome = script?.second_half?.homeScore ?? 0;
  const shAway = script?.second_half?.awayScore ?? 0;

  switch (market_key) {
    // 1. 1X2 (Full Time Result)
    case '1X2':
      if (outcome_key === '1') return ftHome > ftAway;
      if (outcome_key === 'X') return ftHome === ftAway;
      if (outcome_key === '2') return ftAway > ftHome;
      break;

    // 2. Double Chance
    case 'Double_Chance':
      if (outcome_key === '1X') return ftHome >= ftAway;
      if (outcome_key === 'X2') return ftAway >= ftHome;
      if (outcome_key === '12') return ftHome !== ftAway;
      break;

    // 3. Both Teams to Score (BTTS)
    case 'BTTS':
      if (outcome_key === 'Yes') return ftHome > 0 && ftAway > 0;
      if (outcome_key === 'No') return ftHome === 0 || ftAway === 0;
      break;

    // 4. Over / Under Goals (OVER_0.5, UNDER_2.5, etc.)
    case 'Over_Under': {
      const parts = String(outcome_key).split('_'); // e.g. "OVER_2.5" -> ["OVER", "2.5"]
      const type = parts[0];
      const threshold = parseFloat(parts[1]);
      if (type === 'OVER') return totalGoals > threshold;
      if (type === 'UNDER') return totalGoals < threshold;
      break;
    }

    // 5. Correct Score
    case 'Correct_Score': {
      if (outcome_key === 'Other') {
        const standardScores = [
          '0-0', '1-0', '0-1', '1-1', '2-0', '0-2',
          '2-1', '1-2', '2-2', '3-0', '0-3', '3-1',
          '1-3', '3-2', '2-3'
        ];
        return !standardScores.includes(`${ftHome}-${ftAway}`);
      }
      return `${ftHome}-${ftAway}` === outcome_key;
    }

    // 6. Handicap (Home_-1, Away_+2, etc.)
    case 'Handicap': {
      const parts = String(outcome_key).split('_');
      const team = parts[0];
      const margin = parseFloat(parts[1]);

      if (team === 'Home') return (ftHome + margin) > ftAway;
      if (team === 'Away') return (ftAway + margin) > ftHome;
      break;
    }

    // 7. Half Time / Full Time (HT_FT)
    case 'HT_FT': {
      const getResult = (h, a) => (h > a ? 'Home' : a > h ? 'Away' : 'Draw');
      const htResult = getResult(htHome, htAway);
      const ftResult = getResult(ftHome, ftAway);

      const expectedPair = `${htResult}_${ftResult}`; // e.g., "Home_Draw"
      return outcome_key === expectedPair;
    }

    // 8. BTTS + Win Combination
    case 'BTTS_Win': {
      const bttsYes = ftHome > 0 && ftAway > 0;
      const bttsNo = !bttsYes;

      if (outcome_key === 'Home_Yes') return ftHome > ftAway && bttsYes;
      if (outcome_key === 'Home_No') return ftHome > ftAway && bttsNo;
      if (outcome_key === 'Away_Yes') return ftAway > ftHome && bttsYes;
      if (outcome_key === 'Away_No') return ftAway > ftHome && bttsNo;
      if (outcome_key === 'Draw_Yes') return ftHome === ftAway && bttsYes;
      break;
    }

    // 9. Odd / Even Total Goals
    case 'Odd_Even':
      if (outcome_key === 'Odd') return totalGoals % 2 !== 0;
      if (outcome_key === 'Even') return totalGoals % 2 === 0;
      break;

    // 10. Total Exact Goals
    case 'Total_Goals':
      if (outcome_key === '5+') return totalGoals >= 5;
      return totalGoals === parseInt(outcome_key, 10);

    // 11. Goals In Both Halves
    case 'Both_Halves': {
      const htTotal = htHome + htAway;
      const shTotal = shHome + shAway;

      if (outcome_key === 'OVER_0.5_Both') return htTotal > 0.5 && shTotal > 0.5;
      if (outcome_key === 'OVER_1.5_Both') return htTotal > 1.5 && shTotal > 1.5;
      if (outcome_key === 'UNDER_0.5_Both') return htTotal < 0.5 || shTotal < 0.5;
      break;
    }

    // 12. First and Last Goal
    case 'First_Last_Goal': {
      const firstGoal = script?.first_goal_by; // "home", "away", "none"
      const lastGoal = script?.last_goal_by;   // "home", "away", "none"

      if (outcome_key === 'First_Goal_Home') return firstGoal === 'home';
      if (outcome_key === 'First_Goal_Away') return firstGoal === 'away';
      if (outcome_key === 'First_Goal_No') return firstGoal === 'none' || totalGoals === 0;

      if (outcome_key === 'Last_Goal_Home') return lastGoal === 'home';
      if (outcome_key === 'Last_Goal_Away') return lastGoal === 'away';
      if (outcome_key === 'Last_Goal_No') return lastGoal === 'none' || totalGoals === 0;
      break;
    }

    // 13. Highest Scoring Half
    case 'Highest_Scoring_Half': {
      const htTotal = htHome + htAway;
      const shTotal = shHome + shAway;

      if (outcome_key === 'First_Half') return htTotal > shTotal;
      if (outcome_key === 'Second_Half') return shTotal > htTotal;
      if (outcome_key === 'Equal') return htTotal === shTotal;
      break;
    }

    // 14. Clean Sheet
    case 'Clean_Sheet':
      if (outcome_key === 'Home') return ftAway === 0;
      if (outcome_key === 'Away') return ftHome === 0;
      if (outcome_key === 'Both') return ftHome === 0 && ftAway === 0;
      if (outcome_key === 'Neither') return ftHome > 0 && ftAway > 0;
      break;

    default:
      console.warn(`[SETTLEMENT] Soko lisilojulikana: ${market_key}`);
      return false;
  }

  return false;
};

// ============ CHECK ALL MATCHES FINISHED ============
const checkAllMatchesFinished = (bet) => {
  const selections = bet.selections || [];

  if (selections.length === 0) return false;

  for (const sel of selections) {
    const match = sel.match;
    if (!match || match.status !== 'FINISHED') {
      return false;
    }
  }
  return true;
};

// ============ CHECK ALL SELECTIONS WON ============
const checkAllSelectionsWon = (bet) => {
  const selections = bet.selections || [];

  if (selections.length === 0) return false;

  for (const sel of selections) {
    if (sel.status !== 'WON') {
      return false;
    }
  }
  return true;
};

// ============ CHECK ANY SELECTION LOST ============
const checkAnySelectionLost = (bet) => {
  const selections = bet.selections || [];

  for (const sel of selections) {
    if (sel.status === 'LOST') {
      return true;
    }
  }
  return false;
};

// ============ MARK BET SETTLED ============
const markBetSettled = async (bet, result, transaction) => {
  await bet.update({
    status: 'SETTLED',
    result
  }, { transaction });
};

// ============ PER-BET SETTLEMENT (kunyumba kwa BET moja) ============
// Hutumika kwa: bet moja ikimaliza mechi, recovery sweep, na force-settle.
const settleBetIfEligible = async (bet) => {
  if (!bet) return;

  console.log(`[SETTLEMENT] 🔄 Processing bet ${bet.ticket_code}`);

  const transaction = await sequelize.transaction();
  let winNotification = null;

  try {
    const selections = bet.selections || [];
    console.log(`[SETTLEMENT] 📊 Bet has ${selections.length} selections`);

    // ===== 1) TATHMINI (evaluate) selection zote za mechi zilizokamilika =====
    for (const sel of selections) {
      if (sel.status !== 'PENDING') continue;

      const match = sel.match;

      if (!match) {
        console.log(`[SETTLEMENT] ⚠️ No match for selection ${sel.id}`);
        continue;
      }

      console.log(`[SETTLEMENT] 🔍 Selection: ${sel.market_key} - ${sel.outcome_key} | Match: ${match.status}`);

      if (match.status === 'FINISHED') {
        const isWon = evaluateSelection(sel, match);
        const newStatus = isWon ? 'WON' : 'LOST';

        console.log(`[SETTLEMENT] ${isWon ? '✅' : '❌'} Selection -> ${newStatus}`);
        await sel.update({ status: newStatus }, { transaction });
      } else if (match.status === 'CANCELLED') {
        await sel.update({ status: 'CANCELLED' }, { transaction });
      }
    }

    // ===== 2) AMUA RESULT YA MKEEKA =====
    // - Ikiwa selection yoyote imepoteza, mkeka hautoshi (LOST) - settle papo hapo.
    // - Ikiwa mechi zote zimekamilika, tunaweza ku-settle.
    // - Vinginevyo (mechi zinayoendelea) tunasubiri.
    const hasLostSelection = checkAnySelectionLost(bet);
    const allMatchesFinished = checkAllMatchesFinished(bet);

    if (hasLostSelection) {
      console.log(`[SETTLEMENT] ❌ Bet ${bet.ticket_code} LOST (selection imepoteza) -> SETTLED`);
      await markBetSettled(bet, 'LOST', transaction);
    } else if (allMatchesFinished) {
      // Mechi zote zimekamilika na hakuna selection iliyopoteza
      const allSelectionsWon = checkAllSelectionsWon(bet);
      const hasCancelledSelection = selections.some(s => s.status === 'CANCELLED');

      if (allSelectionsWon) {
        console.log(`[SETTLEMENT] ✅ Bet ${bet.ticket_code} WON -> SETTLED`);
        await markBetSettled(bet, 'WON', transaction);

        const payoutAmount = parseFloat(bet.payout);
        if (payoutAmount > 0) {
          console.log(`[SETTLEMENT] 💰 Paying ${payoutAmount} to user ${bet.user_id}`);
          await userRepository.deposit(bet.user_id, payoutAmount, transaction);
          winNotification = { userId: bet.user_id, payout: payoutAmount, ticket: bet.ticket_code };
        }
      } else if (hasCancelledSelection) {
        // Selection imevetwa (rare) - mkeka unachukuliwa kama LOST kwa usalama
        console.log(`[SETTLEMENT] ⚠️ Bet ${bet.ticket_code} has cancelled selection -> LOST`);
        await markBetSettled(bet, 'LOST', transaction);
      } else {
        console.log(`[SETTLEMENT] ⚠️ Bet ${bet.ticket_code} has mixed statuses - setting as LOST`);
        await markBetSettled(bet, 'LOST', transaction);
      }
    } else {
      console.log(`[SETTLEMENT] ⏳ Bet ${bet.ticket_code} still has pending matches (${selections.filter(s => s.status === 'PENDING').length} pending)`);
    }

    await transaction.commit();
    console.log(`[SETTLEMENT] ✅ Bet ${bet.ticket_code} processed`);

    // Notify the user they won (only after a successful commit)
    if (winNotification) {
      try {
        const user = await userRepository.findById(winNotification.userId);
        if (user) {
          const payout = winNotification.payout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          await notificationService.sendToUser({
            phone_number: user.phone_number,
            title: '🎉 You Won!',
            message: `Congratulations! You won TSh ${payout}. Your payout has been credited to your balance.`,
            type: 'success',
            metadata: {
              type: 'bet_win',
              ticket_code: winNotification.ticket,
              payout: winNotification.payout
            }
          });
          console.log(`[SETTLEMENT] 📢 Win notification sent to user ${user.phone_number} (TSh ${payout})`);
        }
      } catch (notifError) {
        console.error('[SETTLEMENT] ⚠️ Could not send win notification:', notifError.message);
      }
    }

    return true;

  } catch (error) {
    await transaction.rollback();
    console.error(`[SETTLEMENT] ❌ Error settling bet ${bet.id}:`, error);
    return false;
  }
};

// ============ MAIN SETTLEMENT FUNCTION (Mechi moja imemalizika) ============
const settlePendingBets = async (finishedMatchId) => {
  console.log(`[SETTLEMENT] 🚀 Starting settlement for match ${finishedMatchId}`);

  try {
    // Hupata bets zote OPEN zilizo na selection ya match hii,
    // pamoja na selections/matches ZAKE ZOTE (sio match moja tu).
    const openBets = await betRepository.findOpenBetsByMatchId(finishedMatchId);

    if (!openBets || openBets.length === 0) {
      console.log(`[SETTLEMENT] ℹ️ No open bets found for match ${finishedMatchId}`);
      return;
    }

    console.log(`[SETTLEMENT] 📋 Found ${openBets.length} open bets`);

    for (const bet of openBets) {
      await settleBetIfEligible(bet);
    }

    console.log(`[SETTLEMENT] ✅ Settlement completed for match ${finishedMatchId}`);

  } catch (error) {
    console.error(`[SETTLEMENT] ❌ Fatal error:`, error);
  }
};

// ============ RECOVERY SWEEP (Mikaka iliyobaki OPEN) ============
// Inaangalia mikeka yote OPEN: kama mechi zake zote zimekamilika
// (hata kama server ilikuwa mbali wakati mechi zilipomalizika),
// husettle ipasavyo (WON au LOST).
const settleAllEligibleOpenBets = async () => {
  console.log(`[SETTLEMENT] 🔁 Recovery sweep: scanning all OPEN bets...`);

  try {
    const openBets = await betRepository.findAllOpenBets();

    if (!openBets || openBets.length === 0) {
      console.log(`[SETTLEMENT] ℹ️ No open bets to recover`);
      return;
    }

    console.log(`[SETTLEMENT] 📋 ${openBets.length} open bets found - checking eligibility`);

    for (const bet of openBets) {
      await settleBetIfEligible(bet);
    }

  } catch (error) {
    console.error(`[SETTLEMENT] ❌ Recovery sweep error:`, error);
  }
};

// ============ FORCE SETTLE SPECIFIC BET ============
const settleSpecificBet = async (betId) => {
  console.log(`[SETTLEMENT] 🔧 Force settling bet ${betId}`);

  const bet = await betRepository.findBetById(betId);
  if (!bet) {
    throw new Error('Bet not found');
  }

  await settleBetIfEligible(bet);

  return betRepository.findBetById(betId);
};

module.exports = {
  settlePendingBets,
  settleAllEligibleOpenBets,
  settleSpecificBet,
  evaluateSelection,
  checkAllMatchesFinished,
  checkAllSelectionsWon,
  checkAnySelectionLost
};