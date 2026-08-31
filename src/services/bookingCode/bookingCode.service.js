// services/bookingCode/bookingCode.service.js
// Booking Code service
// - Kuunda code ni PUBLIC (bila login): hupokea [{ match_id, market_key, outcome_key }]
// - Kupakia code ni PUBLIC: hurejeshwa taarifa za mechi zake halisi za sasa

const bookingCodeRepository = require('../../repositories/bookingCode/bookingCode.repository');
const matchRepository = require('../../repositories/match/match.repository');

const CODE_LENGTH = 6;

// Hutoa raw market key kutoka display ("1X2 | Full Time" => "1X2")
const normalizeMarketKey = (m) => {
  if (!m) return '1X2';
  const base = String(m).replace(/\s*\|.*$/, '').trim();
  return base || '1X2';
};

const generateShortCode = (length = CODE_LENGTH) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Tafsiri date (YYYY-MM-DD) + time ("19:30" / "7:30 PM") kuwa Date kamili
const parseMatchDateTime = (dateStr, timeStr) => {
  try {
    if (!timeStr) return new Date(dateStr);

    const timeParts = timeStr.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);

    if (!timeParts) {
      return new Date(dateStr);
    }

    let hours = parseInt(timeParts[1], 10);
    const minutes = parseInt(timeParts[2], 10);
    const modifier = timeParts[3];

    if (modifier === 'pm' && hours < 12) hours += 12;
    if (modifier === 'am' && hours === 12) hours = 0;

    const isoString = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    const parsedDate = new Date(isoString);

    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  } catch (err) {
    return new Date();
  }
};

// Chukua odds ya sasa ya chaguo kutoka kwenye match (odds JSON ya mechi halisi)
const resolveOutcomeOdds = (match, marketKey, outcomeKey) => {
  const marketOdds = match && match.odds ? match.odds[marketKey] : null;
  if (!marketOdds || marketOdds[outcomeKey] === undefined || marketOdds[outcomeKey] === null) {
    return null;
  }
  const parsed = parseFloat(marketOdds[outcomeKey]);
  return isNaN(parsed) ? null : parsed;
};

// ============ CREATE (PUBLIC, bila login) ============
const createBookingCode = async ({ selections }) => {
  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    throw new Error('Chagua angalau mechi moja ili kutengeneza booking code.');
  }

  let calculatedTotalOdds = 1.0;
  let earliestMatchTime = null;
  const processedSelections = [];
  const seen = new Set();

  for (const sel of selections) {
    const matchId = sel.match_id || sel.matchId || sel.id;
    const marketKey = normalizeMarketKey(sel.market_key || sel.market || '1X2');
    const outcomeKey = sel.outcome_key ?? sel.pick ?? sel.selection ?? null;

    if (!matchId) {
      throw new Error('Kila selection lazima iwe na match_id.');
    }
    if (!outcomeKey) {
      throw new Error(`Outcome (1/X/2) haijachaguliwa kwa mechi ${matchId}.`);
    }

    const match = await matchRepository.findMatchById(matchId);
    if (!match) {
      throw new Error(`Mechi ${matchId} haipo.`);
    }
    // Mechi ya kwanza pekee au zile bado hazijaanza ndizo halali
    if (match.status !== 'UPCOMING') {
      throw new Error(`Mechi ${match.home_team} vs ${match.away_team} tayari imeshaanza au imekamilika.`);
    }

    const currentOdds = resolveOutcomeOdds(match, marketKey, outcomeKey);
    if (currentOdds === null) {
      throw new Error(`Odds hazipatikani kwa masoko yaliyochaguliwa (${marketKey} - ${outcomeKey}).`);
    }

    calculatedTotalOdds *= currentOdds;

    // Epuka kurudia mechi sawa kwenye code moja
    const dedupeKey = `${matchId}|${marketKey}|${outcomeKey}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      processedSelections.push({
        match_id: match.id,
        home_team: match.home_team,
        away_team: match.away_team,
        league: match.league,
        market_key: marketKey,
        outcome_key: outcomeKey,
        odds: currentOdds
      });
    }

    // Wakati wa kwanza wa mechi utakuwa muda wa code kuisha
    const matchDate = parseMatchDateTime(match.date, match.time);
    if (!earliestMatchTime || matchDate < earliestMatchTime) {
      earliestMatchTime = matchDate;
    }
  }

  if (processedSelections.length === 0) {
    throw new Error('Hakuna selections halali za kuweka kwenye booking code.');
  }

  const code = generateShortCode();
  const now = new Date();
  const expiresAt = earliestMatchTime && earliestMatchTime > now
    ? earliestMatchTime
    : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return await bookingCodeRepository.createBookingCode({
    code,
    selections: processedSelections,
    total_odds: parseFloat(calculatedTotalOdds.toFixed(2)),
    is_active: true,
    expires_at: expiresAt
  });
};

// ============ LOAD / DETAILS (PUBLIC, bila login) ============
const getBookingCodeDetails = async (code) => {
  if (!code) {
    throw new Error('Tafadhali weka booking code.');
  }

  const booking = await bookingCodeRepository.findBookingCodeByCode(code.toUpperCase());
  if (!booking) {
    throw new Error('Booking code hii haipo au imeshapitwa na wakati.');
  }

  // 1. Angalia expiry: muda umepita => deactivate
  if (new Date() > new Date(booking.expires_at)) {
    await bookingCodeRepository.deactivateBookingCode(booking.code);
    throw new Error('Booking code hii imepita muda wake.');
  }

  // 2. Tafuta mechi zote zilizomo kwa pamoja
  const matchIds = booking.selections.map((s) => s.match_id);
  const matches = await matchRepository.findMatchesByIds(matchIds);

  let currentTotalOdds = 1.0;
  const updatedSelections = [];

  for (const item of booking.selections) {
    const match = matches.find((m) => m.id === item.match_id);

    // Mechi haipo au sio UPCOMING tena => code haiwezi kutumika
    if (!match || match.status !== 'UPCOMING') {
      await bookingCodeRepository.deactivateBookingCode(booking.code);
      throw new Error('Booking code hii imepita muda wake.');
    }

    // Odds za sasa (live) au zile zilizohifadhiwa
    const liveOdds = resolveOutcomeOdds(match, item.market_key, item.outcome_key) ?? item.odds;
    currentTotalOdds *= parseFloat(liveOdds);

    updatedSelections.push({
      ...item,
      odds: parseFloat(liveOdds)
    });
  }

  return {
    code: booking.code,
    total_odds: parseFloat(currentTotalOdds.toFixed(2)),
    selections: updatedSelections,
    expires_at: booking.expires_at
  };
};

// ============ ADMIN: BOOKING CODES ZOTE (LIST + STATUS) ============
// Inaonyesha zote zilizoundwa na status yake: ACTIVE / EXPIRED / DEACTIVATED.
// Admin anaweza kutafuta code yeyote kwa kuandika code yenyewe.
const deriveBookingCodeStatus = (code) => {
  if (!code.is_active) return 'DEACTIVATED';
  if (new Date() > new Date(code.expires_at)) return 'EXPIRED';
  return 'ACTIVE';
};

const getAllBookingCodesAdmin = async ({ search = '', status = '', limit = 50, offset = 0 } = {}) => {
  const { rows, count } = await bookingCodeRepository.listBookingCodesAdmin({
    search,
    status,
    limit,
    offset
  });

  const codes = rows.map((code) => {
    const json = code.toJSON ? code.toJSON() : code;
    return {
      id: json.id,
      code: json.code,
      status: deriveBookingCodeStatus(json),
      total_odds: json.total_odds ? String(json.total_odds) : '1.00',
      selections: Array.isArray(json.selections) ? json.selections : [],
      selections_count: Array.isArray(json.selections) ? json.selections.length : 0,
      expires_at: json.expires_at,
      created_at: json.createdAt,
      creator: json.creator || null
    };
  });

  return {
    codes,
    total: count,
    limit: parseInt(limit, 10) || 50,
    offset: parseInt(offset, 10) || 0,
    hasMore: parseInt(offset, 10) + rows.length < count
  };
};

module.exports = {
  createBookingCode,
  getBookingCodeDetails,
  getAllBookingCodesAdmin
};
