// services/bookingcode/bookingCode.service.js

const bookingCodeRepository = require('../../repositories/bookingcode/bookingCode.repository');
const { ValidationError, NotFoundError } = require('../../utils/errors');

/**
 * Generate unique booking code (6 characters alphanumeric)
 */
const generateUniqueCode = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    const existing = await bookingCodeRepository.findByCode(code);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    code = code + Date.now().toString().slice(-2);
  }

  return code;
};

/**
 * Calculate expiry time (current time + 5 hours)
 */
const calculateExpiry = () => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 5);
  return expiry;
};

/**
 * Create a new booking code with selections (PUBLIC - no login required)
 */
const createBookingCode = async (userId, selectionsData) => {
  console.log('📝 createBookingCode called');
  console.log('📝 userId:', userId);
  console.log('📝 selectionsData:', JSON.stringify(selectionsData, null, 2));
  
  if (!Array.isArray(selectionsData) || selectionsData.length === 0) {
    throw new ValidationError('At least one selection is required');
  }

  selectionsData.forEach((selection, index) => {
    if (!selection.matchId || !selection.selectionType || !selection.selectionValue || !selection.odds) {
      throw new ValidationError(`Selection ${index + 1} is missing required fields`);
    }
    
    const odds = parseFloat(selection.odds);
    if (isNaN(odds) || odds <= 1) {
      throw new ValidationError(`Invalid odds for selection ${index + 1}`);
    }

    if (!['HOME', 'DRAW', 'AWAY', 'OVER', 'UNDER', 'YES', 'NO'].includes(selection.selectionType)) {
      throw new ValidationError(`Invalid selection type for selection ${index + 1}`);
    }
  });

  const code = await generateUniqueCode();
  const expiresAt = calculateExpiry();

  const selectionsJSON = selectionsData.map(selection => ({
    matchId: selection.matchId,
    matchName: selection.matchName,
    selectionType: selection.selectionType,
    selectionValue: selection.selectionValue,
    odds: selection.odds,
    score: null,
    result: 'PENDING',
    time: selection.time || '',
    date: selection.date || '',
    league: selection.league || '',
    marketType: selection.marketType || '1X2'
  }));

  console.log('📝 Selections JSON:', JSON.stringify(selectionsJSON, null, 2));

  const bookingCode = await bookingCodeRepository.create({
    code,
    userId: userId || null,
    selections: selectionsJSON,
    expiresAt,
    status: 'ACTIVE'
  });

  console.log('✅ Booking code created:', bookingCode.id);
  console.log('✅ Total selections:', selectionsJSON.length);

  return {
    bookingCode: {
      id: bookingCode.id,
      code: bookingCode.code,
      expiresAt: bookingCode.expiresAt,
      status: bookingCode.status
    },
    selections: selectionsJSON,
    totalSelections: selectionsJSON.length
  };
};

/**
 * Load booking code by code string - PUBLIC
 */
const loadBookingCode = async (code) => {
  if (!code) {
    throw new ValidationError('Booking code is required');
  }

  const bookingCode = await bookingCodeRepository.findActiveByCode(code);

  if (!bookingCode) {
    const existingCode = await bookingCodeRepository.findByCode(code);
    
    if (!existingCode) {
      throw new NotFoundError('Booking code not found');
    }
    
    throw new ValidationError('Booking code has expired (5 hours limit)');
  }

  const selections = bookingCode.selections || [];
  const totalSelections = Array.isArray(selections) ? selections.length : 0;

  return {
    bookingCode: {
      id: bookingCode.id,
      code: bookingCode.code,
      expiresAt: bookingCode.expiresAt,
      createdAt: bookingCode.createdAt,
      status: bookingCode.status
    },
    selections: selections,
    totalSelections: totalSelections
  };
};

/**
 * Get booking code by ID
 */
const getBookingCodeById = async (id) => {
  if (!id) throw new ValidationError('Booking code ID is required');

  const bookingCode = await bookingCodeRepository.findById(id);
  if (!bookingCode) throw new NotFoundError('Booking code not found');

  return bookingCode;
};

/**
 * Get all booking codes by user
 */
const getUserBookingCodes = async (userId) => {
  if (!userId) throw new ValidationError('User ID is required');

  return await bookingCodeRepository.findByUserId(userId);
};

/**
 * Get all booking codes (admin only)
 */
const getAllBookingCodes = async (options = {}) => {
  return await bookingCodeRepository.findAll(options);
};

/**
 * Update selection score with all fields
 * @param {string} bookingCodeId - Booking code ID
 * @param {string} matchId - Match ID
 * @param {number} homeScore - Home score
 * @param {number} awayScore - Away score
 * @param {string} selectionType - HOME, DRAW, AWAY
 * @param {string} marketType - Market type (e.g., 1X2, Double Chance, BTTS, etc.)
 */
const updateSelectionScore = async (bookingCodeId, matchId, homeScore, awayScore, selectionType, marketType) => {
  if (!bookingCodeId) throw new ValidationError('Booking code ID is required');
  if (!matchId) throw new ValidationError('Match ID is required');
  if (homeScore === undefined || awayScore === undefined) {
    throw new ValidationError('Home score and away score are required');
  }
  if (homeScore < 0 || awayScore < 0) {
    throw new ValidationError('Scores cannot be negative');
  }
  if (!selectionType) {
    throw new ValidationError('Selection type is required');
  }
  if (!['HOME', 'DRAW', 'AWAY', 'OVER', 'UNDER', 'YES', 'NO'].includes(selectionType)) {
    throw new ValidationError('Invalid selection type');
  }
  if (!marketType) {
    throw new ValidationError('Market type is required');
  }

  const bookingCode = await bookingCodeRepository.updateSelectionScore(
    bookingCodeId, 
    matchId, 
    homeScore, 
    awayScore,
    selectionType,
    marketType
  );
  
  if (!bookingCode) {
    throw new NotFoundError('Booking code or selection not found');
  }

  return bookingCode;
};

/**
 * Check if code exists and is active - PUBLIC
 */
const checkBookingCode = async (code) => {
  if (!code) {
    throw new ValidationError('Booking code is required');
  }

  const bookingCode = await bookingCodeRepository.findByCode(code);

  if (!bookingCode) {
    return {
      exists: false,
      isActive: false,
      message: 'Booking code not found'
    };
  }

  const now = new Date();
  const isExpired = now > bookingCode.expiresAt;
  const isActive = bookingCode.status === 'ACTIVE' && !isExpired;

  const selections = bookingCode.selections || [];
  const selectionsCount = Array.isArray(selections) ? selections.length : 0;

  return {
    exists: true,
    isActive: isActive,
    isExpired: isExpired,
    expiresAt: bookingCode.expiresAt,
    createdAt: bookingCode.createdAt,
    selectionsCount: selectionsCount,
    message: isActive ? 'Code is active' : 'Code has expired'
  };
};

/**
 * Deactivate booking code
 */
const deactivateBookingCode = async (id) => {
  if (!id) throw new ValidationError('Booking code ID is required');

  const bookingCode = await bookingCodeRepository.updateStatus(id, 'EXPIRED');
  if (!bookingCode) throw new NotFoundError('Booking code not found');

  return bookingCode;
};

/**
 * Delete expired booking codes
 */
const deleteExpiredCodes = async () => {
  const deletedCount = await bookingCodeRepository.deleteExpired();
  return { deletedCount };
};

module.exports = {
  createBookingCode,
  loadBookingCode,
  getBookingCodeById,
  getUserBookingCodes,
  getAllBookingCodes,
  updateSelectionScore,
  checkBookingCode,
  deactivateBookingCode,
  deleteExpiredCodes
};