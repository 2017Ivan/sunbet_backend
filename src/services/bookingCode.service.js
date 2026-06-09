const bookingCodeRepository = require('../repositories/bookingCode.repository');
const { ValidationError, NotFoundError } = require('../utils/errors');

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
 * Create a new booking code
 */
const createBookingCode = async (selections) => {
  // Validate selections
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new ValidationError('At least one selection is required');
  }

  // Validate each selection
  selections.forEach((selection, index) => {
    if (!selection.matchId || !selection.selection || !selection.odds) {
      throw new ValidationError(`Selection ${index + 1} is missing required fields`);
    }
    
    const odds = parseFloat(selection.odds);
    if (isNaN(odds) || odds <= 1) {
      throw new ValidationError(`Invalid odds for selection ${index + 1}`);
    }
  });

  // Generate code and expiry
  const code = await generateUniqueCode();
  const expiresAt = calculateExpiry();

  // Save to database
  const bookingCode = await bookingCodeRepository.create({
    code,
    selections,
    expiresAt,
    status: 'ACTIVE'
  });

  return {
    code: bookingCode.code,
    expiresAt: bookingCode.expiresAt
  };
};

/**
 * Load booking code by code string
 */
const loadBookingCode = async (code) => {
    if (!code) {
      throw new ValidationError('Booking code is required');
    }
  
    // Find active booking code
    const bookingCode = await bookingCodeRepository.findActiveByCode(code);
  
    if (!bookingCode) {
      // Check if code exists but is expired
      const existingCode = await bookingCodeRepository.findByCode(code);
      
      if (!existingCode) {
        throw new NotFoundError('Booking code not found');
      }
      
      throw new ValidationError('Booking code has expired (5 hours limit)');
    }
  
    // Parse selections if it's a string (JSON)
    let selections = bookingCode.selections;
    if (typeof selections === 'string') {
      try {
        selections = JSON.parse(selections);
      } catch (e) {
        console.error('Failed to parse selections:', e);
        selections = [];
      }
    }
  
    return {
      selections: selections,
      expiresAt: bookingCode.expiresAt,
      createdAt: bookingCode.createdAt
    };
  };

/**
 * Check if code exists and is active
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

  return {
    exists: true,
    isActive: isActive,
    isExpired: isExpired,
    expiresAt: bookingCode.expiresAt,
    createdAt: bookingCode.createdAt,
    selectionsCount: bookingCode.selections.length,
    message: isActive ? 'Code is active' : 'Code has expired'
  };
};

module.exports = {
  createBookingCode,
  loadBookingCode,
  checkBookingCode
};