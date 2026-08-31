// services/bet/cashout.service.js

const { sequelize } = require('../../models');
const userRepository = require('../../repositories/user/user.repository');
const betRepository = require('../../repositories/bet/bet.repository');
const { evaluateSelection } = require('./croneJob/betSettlement.service');
const CustomExceptions = require('../../middleware/CustomExceptions');

// ============ CONFIG ============
// Thamani ya cashout inategemea maendeleo ya mechi:
//  - Mechi isiyoanza (UPCOMING)  -> dai linalingana na stake (hapa ni kama kurudishwa full stake)
//  - Mechi ipo LIVE               -> thamani inaanzia stake na kuongezeka polepole (kwa muda)
//     hadi kufikia karibu na possible win. Kiwango cha juu cha maendeleo = LIVE_PROGRESS_CAP.
//  - Mechi imekamilika (FINISHED) -> inahesabiwa kwa odds kamili (ikiwa imeshinda)
const CASHOUT_RATIO = 0.6;
const TAX_RATE = 0.12;
const MATCH_DURATION_MS = 90 * 60 * 1000; // mechi ya mpira = dakika 90
const LIVE_PROGRESS_CAP = 0.95;

// ============ HESABU YA HALI HALISI YA SELECTION (in-memory) ============
// Selection ambayo match yake imekamilika lakini bado status 'PENDING' (kabla ya
// settlement sweep kuendesha) inaamuliwa hapa kwa ajili ya hesabu ya cashout.
const getSelectionEffectiveStatus = (selection) => {
  if (selection.status === 'WON') return 'WON';
  if (selection.status === 'LOST') return 'LOST';
  if (selection.status === 'CANCELLED') return 'CANCELLED';

  const match = selection.match;
  if (match && match.status === 'FINISHED') {
    return evaluateSelection(selection, match) ? 'WON' : 'LOST';
  }
  return 'PENDING';
};

// Kadiri mechi inavyoendelea (imekuwa LIVE), thamani inapanda kutoka stake
// kuelekea possible win. Progress inatokana na muda tangu mechi ilipoanza
// (saa ya kickoff kwenye match), sawia na matenje ya live match engine.
const getLiveProgress = (selection) => {
  const match = selection.match;
  if (!match) return 0;

  const date = match.date;
  const timeParts = String(match.time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!date || !timeParts) return 0;

  let hours = parseInt(timeParts[1], 10);
  const minutes = parseInt(timeParts[2], 10);
  if (timeParts[3] && timeParts[3].toLowerCase() === 'pm' && hours < 12) hours += 12;
  if (timeParts[3] && timeParts[3].toLowerCase() === 'am' && hours === 12) hours = 0;

  const kickoff = new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  if (isNaN(kickoff.getTime())) return 0;

  const elapsed = Date.now() - kickoff.getTime();
  if (elapsed <= 0) return 0;

  const progress = Math.min(1, elapsed / MATCH_DURATION_MS);
  return progress * LIVE_PROGRESS_CAP;
};

// ============ KUKOKOTOA THAMANI YA CASHOUT ============
// Inarudisha 0 ikiwa bet haistahili cashout (imepoteza au imeamuliwa tayari).
const computeCashoutValue = (bet) => {
  const selections = bet.selections || [];
  if (selections.length === 0) return 0;

  let product = 1;
  let hasPending = false;

  for (const sel of selections) {
    const odds = parseFloat(sel.odds_at_placement) || 1;
    const status = getSelectionEffectiveStatus(sel);

    if (status === 'WON') {
      product *= odds;
      continue;
    }
    if (status === 'LOST' || status === 'CANCELLED') {
      return 0;
    }

    // Bado pending - thamani inategemea hali ya mechi
    hasPending = true;
    const matchStatus = sel.match && sel.match.status;

    if (matchStatus === 'LIVE') {
      // Mechi imeanza - cashout inapanda polepole kutoka stake
      const progress = getLiveProgress(sel);
      product *= 1 + (odds - 1) * progress;
    } else {
      // UPCOMING (haijaanza) au hali nyingine yoyote - inachangia stake tu
      product *= 1;
    }
  }

  // Kama hakuna selection iliyosalia pending, bet imeamuliwa kikamilifu -
  // settlement ya kawaida itashughulikia, sio cashout.
  if (!hasPending) return 0;

  const stake = parseFloat(bet.stake) || 0;
  if (stake <= 0) return 0;

  const grossProfit = stake * (product - 1);
  const netProfit = grossProfit * (1 - TAX_RATE);
  const value = stake + netProfit;

  return Math.max(0, parseFloat(value.toFixed(2)));
};

// ============ CASHOUT (OPERATION KAMILI) ============
const cashoutBet = async (userId, betId) => {
  if (!betId) {
    throw new CustomExceptions('Bet ID inahitajika', 400);
  }

  const transaction = await sequelize.transaction();

  try {
    const bet = await betRepository.findBetById(betId, transaction);
    if (!bet) {
      throw new CustomExceptions('Mkeka haujapatikana', 404);
    }
    if (bet.user_id !== userId) {
      throw new CustomExceptions('Huruhusiwi kufanya cashout kwenye mkeka huu', 403);
    }
    if (bet.status !== 'OPEN') {
      throw new CustomExceptions('Mkeka huu hauko wazi tena - cashout haipatikani', 400);
    }
    if (bet.result !== 'PENDING') {
      throw new CustomExceptions('Mkeka huu umeamuliwa tayari - cashout haipatikani', 400);
    }

    // 1) Amua selection zote za FINISHED ambazo bado PENDING (ndani ya transaction)
    for (const sel of bet.selections || []) {
      if (sel.status !== 'PENDING') continue;
      const match = sel.match;
      if (!match) continue;

      if (match.status === 'FINISHED') {
        const isWon = evaluateSelection(sel, match);
        await sel.update({ status: isWon ? 'WON' : 'LOST' }, { transaction });
      } else if (match.status === 'CANCELLED') {
        await sel.update({ status: 'CANCELLED' }, { transaction });
      }
    }

    // 2) Kokotoa thamani ya cashout kwa hali mpya
    const cashoutAmount = computeCashoutValue(bet);

    if (cashoutAmount <= 0) {
      throw new CustomExceptions('Mkeka huu hauwezi kufanyiwa cashout kwa sasa', 400);
    }

    // 3) Funga mkeka kama CASHED_OUT na ulipie balance
    await bet.update({
      status: 'SETTLED',
      result: 'CASHED_OUT',
      payout: cashoutAmount.toFixed(2),
      cashout_amount: cashoutAmount.toFixed(2)
    }, { transaction });

    await userRepository.deposit(userId, cashoutAmount, transaction);

    await transaction.commit();

    return betRepository.findBetById(betId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  computeCashoutValue,
  cashoutBet,
  CASHOUT_RATIO,
  TAX_RATE
};