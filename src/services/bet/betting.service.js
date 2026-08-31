// src/services/bet/ByteLengthQueuingStrategy.service.js 

const { sequelize } = require('../../models');
const userRepository = require('../../repositories/user/user.repository');
const matchRepository = require('../../repositories/match/match.repository');
const betRepository = require('../../repositories/bet/bet.repository');
const { computeCashoutValue, cashoutBet } = require('./cashout.service');
const bookingCodeService = require('../bookingCode/bookingCode.service');

// --- HELPER FUNCTIONS FOR LIVE STATE CALCULATIONS ---

/**
 * Inakokotoa na kuongeza Live Score na Elapsed Minutes kulingana na predetermined_script.
 * Inazuia kutoa predetermined_script kwenda kwa user kwa ajili ya usalama.
 */
const enrichMatchWithLiveState = (match) => {
  if (!match) return match;

  const matchJson = match.toJSON ? match.toJSON() : match;

  // 1. UPCOMING MATCHES
  if (matchJson.status === 'UPCOMING') {
    const { predetermined_script, ...rest } = matchJson;
    return {
      ...rest,
      current_score: { home: 0, away: 0 },
      elapsed_minute: 0
    };
  }

  // 2. FINISHED MATCHES
  if (matchJson.status === 'FINISHED') {
    const { predetermined_script, ...rest } = matchJson;
    const finalScore = predetermined_script?.final_ft || { homeScore: 0, awayScore: 0 };
    return {
      ...rest,
      current_score: { home: finalScore.homeScore, away: finalScore.awayScore },
      elapsed_minute: 'FT'
    };
  }

  // 3. LIVE MATCHES: Calculate Dynamic Live Score & Minutes
  if (matchJson.status === 'LIVE') {
    let elapsedMinutes = 0;

    if (matchJson.time) {
      const timeParts = matchJson.time.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
      if (timeParts) {
        let hours = parseInt(timeParts[1], 10);
        const minutes = parseInt(timeParts[2], 10);
        if (timeParts[3] === 'pm' && hours < 12) hours += 12;
        if (timeParts[3] === 'am' && hours === 12) hours = 0;

        const matchStartTime = new Date(`${matchJson.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
        elapsedMinutes = Math.max(0, Math.floor((new Date() - matchStartTime) / (1000 * 60)));
      }
    }

    const timeline = matchJson.predetermined_script?.events_timeline || [];

    // Filter matukio yaliyotokea kabla au ndani ya dakika hii
    const pastEvents = timeline.filter((evt) => {
      const minuteNum = parseInt(evt.minute.split('+')[0], 10);
      return minuteNum <= elapsedMinutes;
    });

    const calculatedScore = pastEvents.length > 0
      ? pastEvents[pastEvents.length - 1].current_score
      : { home: 0, away: 0 };

    const { predetermined_script, ...rest } = matchJson;

    return {
      ...rest,
      current_score: calculatedScore,
      elapsed_minute: elapsedMinutes
    };
  }

  return matchJson;
};

/**
 * Ina-format ticket kamili pamoja na mechi zake kabla ya kuirudisha kwa client
 */
const formatBetResponse = (bet) => {
  if (!bet) return null;

  const betJson = bet.toJSON ? bet.toJSON() : bet;

  const formattedSelections = (betJson.selections || []).map((sel) => ({
    ...sel,
    match: enrichMatchWithLiveState(sel.match)
  }));

  // Cashout offer (bet bado OPEN na PENDING)
  let cashout_value = null;
  if (
    String(betJson.status).toUpperCase() === 'OPEN' &&
    String(betJson.result).toUpperCase() === 'PENDING'
  ) {
    cashout_value = computeCashoutValue(betJson);
  }

  return {
    ...betJson,
    selections: formattedSelections,
    cashout_value
  };
};

const generateTicketCode = () => {
  const prefix = 'TK';
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${randomDigits}`;
};

// --- CORE BET SERVICES ---

const placeBet = async (userId, { stake, selections, placed_via = 'DIRECT', booking_code_used = null }) => {
  const numericStake = parseFloat(stake);
  if (isNaN(numericStake) || numericStake <= 0) {
    throw new Error('Kiasi cha dau (stake) lazima kiwe kikubwa kuliko 0.');
  }

  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    throw new Error('Lazima uchague angalau mechi moja ili kubeti.');
  }

  // 1. ZUIA CHAGUO ZAIDI YA MOJA KWENYE MECHI MOJA
  const matchIds = selections.map((s) => s.match_id);
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

      const marketOdds = match.odds?.[sel.market_key];
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
      status: 'OPEN',
      placed_via,
      booking_code_used
    };

    const newBet = await betRepository.createBet(betData, validatedSelections, transaction);

    await transaction.commit();

    // 7. TENGENEZA BOOKING CODE TAUTOMATICALLY (non-critical)
    let bookingCode = null;
    try {
      const bookingSelections = validatedSelections.map(s => ({
        match_id: s.match_id,
        market_key: s.market_key,
        outcome_key: s.outcome_key
      }));
      const bookingResult = await bookingCodeService.createBookingCode({ selections: bookingSelections });
      bookingCode = bookingResult.code;
    } catch (bookingErr) {
      console.error('Auto booking code creation failed:', bookingErr.message);
    }

    const response = formatBetResponse(newBet);
    response.booking_code = bookingCode;
    return response;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getUserBets = async (userId) => {
  const bets = await betRepository.findBetsByUserId(userId);
  return bets.map(formatBetResponse);
};

// ADMIN: bets zote kwenye mfumo (list-only) - search kwa namba ya simu ya user
const getAllBetsAdmin = async ({ search = '', limit = 50, offset = 0 } = {}) => {
  const { rows, count } = await betRepository.findAllBetsAdmin({ search, limit, offset });

  return {
    bets: rows.map(formatBetResponse),
    total: count,
    limit: parseInt(limit, 10) || 50,
    offset: parseInt(offset, 10) || 0,
    hasMore: parseInt(offset, 10) + rows.length < count
  };
};

const getBetByTicketCode = async (ticketCode) => {
  const bet = await betRepository.findBetByTicketCode(ticketCode);
  if (!bet) {
    throw new Error('Mkeka haujapatikana.');
  }
  return formatBetResponse(bet);
};

// ============ USHINDI UNAOSUBIRI KUONEKANA (WIN CELEBRATION) ============
// Inarudisha bet zote zilizoshinda ambazo user bado hajazitambua
// (mbunge variant ya 'win notification' inayojitokeza baada ya kuingia).
const getWinNotifications = async (userId) => {
  const bets = await betRepository.findUnacknowledgedWins(userId);
  return bets.map((bet) => {
    const json = bet.toJSON ? bet.toJSON() : bet;
    return {
      id: json.id,
      ticket_code: json.ticket_code,
      stake: json.stake ? String(json.stake) : '0',
      total_odds: json.total_odds ? String(json.total_odds) : '1.00',
      possible_win: json.possible_win ? String(json.possible_win) : '0',
      payout: json.payout ? String(json.payout) : '0',
      result: json.result,
      win_acknowledged: json.win_acknowledged,
      selections_count: Array.isArray(json.selections) ? json.selections.length : 0,
      created_at: json.createdAt || json.created_at || null
    };
  });
};

// Inaweka alama ya 'imeonekana' kwenye bet iliyoshindwa (win) - mmiliki pekee ndiye
// anayeweza, na tu kama bet iko SETTLED na result WON.
const acknowledgeWin = async (userId, betId) => {
  if (!betId) {
    const error = new Error('Bet ID inahitajika.');
    error.status = 400;
    throw error;
  }

  const bet = await betRepository.findBetById(betId);
  if (!bet) {
    const error = new Error('Mkeka haujapatikana.');
    error.status = 404;
    throw error;
  }
  if (bet.user_id !== userId) {
    const error = new Error('Huruhusiwi kutambua ushindi wa mkeka huu.');
    error.status = 403;
    throw error;
  }
  if (
    bet.status !== 'SETTLED' ||
    String(bet.result).toUpperCase() !== 'WON'
  ) {
    const error = new Error('Mkeka huu hauna ushindi unaostahili kutambuliwa.');
    error.status = 400;
    throw error;
  }

  const acknowledged = await betRepository.markWinAsAcknowledged(betId);
  return { bet_id: betId, acknowledged };
};

module.exports = {
  placeBet,
  getUserBets,
  getAllBetsAdmin,
  getBetByTicketCode,
  cashoutBet,
  getWinNotifications,
  acknowledgeWin
};