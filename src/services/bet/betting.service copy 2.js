// services/bet/ByteLengthQueuingStrategy.service.js 

const { sequelize } = require('../../models');
const userRepository = require('../../repositories/user/user.repository');
const matchRepository = require('../../repositories/match/match.repository');
const betRepository = require('../../repositories/bet/bet.repository');

const generateTicketCode = () => {
  const prefix = 'TK';
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${randomDigits}`;
};

const placeBet = async (userId, { stake, selections, placed_via = 'DIRECT', booking_code_used = null }) => {
  const numericStake = parseFloat(stake);
  if (isNaN(numericStake) || numericStake <= 0) {
    throw new Error('Kiasi cha dau (stake) lazima kiwe kikubwa kuliko 0.');
  }

  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    throw new Error('Lazima uchague angalau mechi moja ili kubeti.');
  }

  // 1. ZUIA CHAGUO ZAIDI YA MOJA KWENYE MECHI MOJA
  const matchIds = selections.map(s => s.match_id);
  const uniqueMatchIds = new Set(matchIds);
  if (uniqueMatchIds.size !== matchIds.length) {
    throw new Error('Huruhusiwi kuweka masoko au chaguo zaidi ya moja kutoka mechi moja.');
  }

  const transaction = await sequelize.transaction();

  try {
    // 2. Kagua User na Salio
    const user = await userRepository.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Akaunti haijapatikana au imefungiwa.');
    }

    const currentBalance = parseFloat(user.balance);
    if (currentBalance < numericStake) {
      throw new Error('Salio lako halitoshi kuweka mkeka huu.');
    }

    // 3. Kagua mechi, odds na Piga Hesabu ya Total Odds
    let calculatedTotalOdds = 1.0;
    const validatedSelections = [];

    for (const sel of selections) {
      const match = await matchRepository.findMatchById(sel.match_id);
      if (!match) {
        throw new Error(`Mechi yenye ID ${sel.match_id} haijapatikana.`);
      }

      if (match.status !== 'UPCOMING') {
        throw new Error(`Mechi kati ya ${match.home_team} vs ${match.away_team} imeshaanza au kumalizika.`);
      }

      const marketOdds = match.odds[sel.market_key];
      if (!marketOdds || marketOdds[sel.outcome_key] === undefined) {
        throw new Error(`Soko la ${sel.market_key} - ${sel.outcome_key} halipatikani kwenye mechi hii.`);
      }

      const currentOdds = parseFloat(marketOdds[sel.outcome_key]);
      calculatedTotalOdds *= currentOdds;

      validatedSelections.push({
        match_id: match.id,
        market_key: sel.market_key,
        outcome_key: sel.outcome_key,
        odds_at_placement: currentOdds,
        status: 'PENDING'
      });
    }

    // 4. HESABU ZA FINANCIAL (Potential Win, Kodi 12%, na Payout)
    const finalTotalOdds = parseFloat(calculatedTotalOdds.toFixed(2));
    const potentialWin = numericStake * (finalTotalOdds - 1);
    const taxAmount = potentialWin * 0.12;
    const netPayout = (potentialWin - taxAmount) + numericStake;

    // 5. Kata Salio la User
    const newBalance = currentBalance - numericStake;
    await userRepository.withdraw(userId, newBalance, transaction);

    // 6. Hifadhi Bet
    const ticketCode = generateTicketCode();
    const betData = {
      ticket_code: ticketCode,
      user_id: userId,
      stake: numericStake,
      total_odds: finalTotalOdds.toFixed(2),
      possible_win: potentialWin.toFixed(2),
      tax: taxAmount.toFixed(2),
      payout: netPayout.toFixed(2),
      status: 'PENDING',
      placed_via,
      booking_code_used
    };

    const newBet = await betRepository.createBet(betData, validatedSelections, transaction);

    await transaction.commit();
    return newBet;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getUserBets = async (userId) => {
  return await betRepository.findBetsByUserId(userId);
};

const getBetByTicketCode = async (ticketCode) => {
  const bet = await betRepository.findBetByTicketCode(ticketCode);
  if (!bet) {
    throw new Error('Mkeka haujapatikana.');
  }
  return bet;
};

module.exports = {
  placeBet,
  getUserBets,
  getBetByTicketCode
};