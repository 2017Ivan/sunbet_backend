const cron = require('node-cron');
const { sequelize, Match, Bet, BetSelection, User } = require('../../models');
const betRepository = require('../../repositories/bet/bet.repository');

// --- 1. EVALUATE SELECTION ENGINE (MASOKO YOTE 15) ---
/**
 * Inaangalia kama chaguo la mechi lilishinda au lilipoteza kulingana na predetermined_script.
 * @param {Object} selection - { market_key, outcome_key }
 * @param {Object} script - match.predetermined_script
 */
const evaluateSelection = (selection, script) => {
  const { market_key, outcome_key } = selection;

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
      const parts = outcome_key.split('_'); // e.g. "OVER_2.5" -> ["OVER", "2.5"]
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
      const [team, marginStr] = outcome_key.split('_');
      const margin = parseFloat(marginStr);

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

// --- 2. SETTLEMENT ENGINE ---
/**
 * Ina-settle mikeka yote punde tu mechi inapomalizika
 */
const settleBetsForFinishedMatch = async (matchId, script) => {
  const pendingSelections = await BetSelection.findAll({
    where: { match_id: matchId, status: 'PENDING' }
  });

  if (pendingSelections.length === 0) return;

  for (const selection of pendingSelections) {
    const isWon = evaluateSelection(selection, script);
    const newSelectionStatus = isWon ? 'WON' : 'LOST';

    // Update Selection Status
    await betRepository.updateBetSelectionStatus(selection.id, newSelectionStatus);

    // Kagua Mkeka mzima (Bet)
    const bet = await betRepository.findBetById(selection.bet_id);
    if (!bet || bet.status !== 'PENDING') continue;

    const allSelections = bet.selections || [];
    const hasLostSelection = allSelections.some(s => s.status === 'LOST');
    const allWon = allSelections.length > 0 && allSelections.every(s => s.status === 'WON');

    // Scenario A: Mkeka umepoteza
    if (hasLostSelection) {
      await betRepository.updateBetStatus(bet.id, 'LOST');
    } 
    // Scenario B: Mkeka umeshinda (Pay user within Transaction)
    else if (allWon) {
      const transaction = await sequelize.transaction();
      try {
        await betRepository.updateBetStatus(bet.id, 'WON', transaction);

        const user = await User.findByPk(bet.user_id, { transaction });
        if (user) {
          const currentBal = parseFloat(user.balance);
          const payoutAmt = parseFloat(bet.payout);
          const updatedBal = currentBal + payoutAmt;

          await user.update({ balance: updatedBal }, { transaction });
        }

        await transaction.commit();
        console.log(`[SETTLEMENT SUCCESS] Ticket ${bet.ticket_code} imeshinda TZS ${bet.payout}!`);
      } catch (err) {
        await transaction.rollback();
        console.error(`[SETTLEMENT ERROR] Kushindwa ku-settle bet ${bet.id}:`, err);
      }
    }
  }
};

// --- 3. CORE CRON ENGINE PROCESSOR ---
const processMatchesLifecycle = async (io = null) => {
  try {
    const activeMatches = await Match.findAll({
      where: { status: ['UPCOMING', 'LIVE'] }
    });

    const now = new Date();

    for (const match of activeMatches) {
      if (!match.time || !match.date) continue;

      // PARSE TIME (e.g., "11:00 am" -> Date Object)
      const timeParts = match.time.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
      if (!timeParts) continue;

      let hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      if (timeParts[3] === 'pm' && hours < 12) hours += 12;
      if (timeParts[3] === 'am' && hours === 12) hours = 0;

      const matchStartTime = new Date(`${match.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
      const elapsedMinutes = Math.floor((now - matchStartTime) / (1000 * 60));

      // STATE 1: UPCOMING -> LIVE
      if (match.status === 'UPCOMING' && elapsedMinutes >= 0) {
        await match.update({
          status: 'LIVE',
          current_score: { home: 0, away: 0 }
        });
        console.log(`[MATCH ENGINE] Mechi ID ${match.id} (${match.home_team} vs ${match.away_team}) ipo LIVE!`);
      }

      // STATE 2: LIVE SCORE UDPATES VIA TIMELINE
      if (match.status === 'LIVE' || (match.status === 'UPCOMING' && elapsedMinutes >= 0)) {
        const timeline = match.predetermined_script?.events_timeline || [];
        
        const pastEvents = timeline.filter((evt) => {
          const minuteNum = parseInt(evt.minute.split('+')[0], 10);
          return minuteNum <= elapsedMinutes;
        });

        const latestScore = pastEvents.length > 0
          ? pastEvents[pastEvents.length - 1].current_score
          : { home: 0, away: 0 };

        if (JSON.stringify(match.current_score) !== JSON.stringify(latestScore)) {
          await match.update({ current_score: latestScore });

          if (io) {
            io.emit('match_score_update', {
              match_id: match.id,
              current_score: latestScore,
              elapsed_minute: elapsedMinutes
            });
          }
        }

        // STATE 3: LIVE -> FINISHED (FT)
        if (elapsedMinutes >= 90) {
          const script = match.predetermined_script || {};
          const finalScore = script.final_ft || {
            homeScore: latestScore.home || 0,
            awayScore: latestScore.away || 0
          };

          await match.update({
            status: 'FINISHED',
            current_score: { home: finalScore.homeScore, away: finalScore.awayScore }
          });

          console.log(`[MATCH ENGINE] Mechi ${match.id} imemalizika FT (${finalScore.homeScore}-${finalScore.awayScore})`);

          // Settle Bets Zote Za Mechi Hii
          await settleBetsForFinishedMatch(match.id, script);

          if (io) {
            io.emit('match_finished', {
              match_id: match.id,
              final_score: finalScore
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[CRON ENGINE ERROR]:', error);
  }
};

// --- 4. START SCHEDULER ---
const startMatchCronJob = (io = null) => {
  // Inakimbia kila dakika 1
  cron.schedule('* * * * *', async () => {
    console.log('[CRON ENGINE] Checking Match Lifecycles & Settlements...');
    await processMatchesLifecycle(io);
  });
};

module.exports = {
  startMatchCronJob,
  processMatchesLifecycle
};