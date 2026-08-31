// services/bet/betSettlement.service.js
const { sequelize } = require('../../../models');
const userRepository = require('../../../repositories/user/user.repository');
const betRepository = require('../../../repositories/bet/bet.repository');

// Logic ya kuangalia kama soko/outcome husika imepita au imefeli
const evaluateSelection = (selection, match) => {
  const { market_key, outcome_key } = selection;
  const script = match.predetermined_script;
  const ft = script.final_ft; // { homeScore, awayScore }
  
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

// Function kuu ya Ku-settle Mikeka yote yenye Mechi iliyomalizika
const settlePendingBets = async (finishedMatchId) => {
  // 1. Tafuta mikeka yote PENDING yenye hii mechi
  const pendingBets = await betRepository.findPendingBetsByMatchId(finishedMatchId);

  for (const bet of pendingBets) {
    const transaction = await sequelize.transaction();
    try {
      let allSelectionsWon = true;
      let hasLostSelection = false;

      // Kagua selections zote kwenye mkeka huu
      for (const sel of bet.Selections) {
        if (sel.status === 'PENDING') {
          const match = sel.Match;
          
          if (match.status === 'FINISHED') {
            const isWon = evaluateSelection(sel, match);
            sel.status = isWon ? 'WON' : 'LOST';
            await sel.save({ transaction });
          }
        }

        if (sel.status === 'LOST') hasLostSelection = true;
        if (sel.status !== 'WON') allSelectionsWon = false;
      }

      // Update Bet Status & Wallet
      if (hasLostSelection) {
        bet.status = 'LOST';
        await bet.save({ transaction });
      } else if (allSelectionsWon) {
        bet.status = 'WON';
        await bet.save({ transaction });

        // Lipa hela ya ushindi kwenye Wallet ya User!
        const payoutAmount = parseFloat(bet.payout);
        await userRepository.deposit(bet.user_id, payoutAmount, transaction);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error(`Error settling bet ID ${bet.id}:`, error);
    }
  }
};

module.exports = { settlePendingBets };