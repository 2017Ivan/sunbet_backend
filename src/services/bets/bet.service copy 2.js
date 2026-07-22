// services/bets/bet.service.js

const betRepository = require('../../repositories/bets/bet.repository');
const userRepository = require('../../repositories/user.repository');
const bookingCodeRepository = require('../../repositories/bookingcode/bookingCode.repository');
const {
  ValidationError,
  NotFoundError,
  InsufficientBalanceError
} = require('../../utils/errors');

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
 * Create booking code with selections SILENTLY (hakuna selection table)
 */
const createBookingCodeSilently = async (userId, selectionsData) => {
  console.log('🔄 Creating booking code silently...');
  console.log('📝 selectionsData:', JSON.stringify(selectionsData, null, 2));
  
  const code = await generateUniqueCode();
  const expiresAt = calculateExpiry();

  const selectionsJSON = selectionsData.map(selection => ({
    matchId: selection.matchId,
    matchName: selection.matchName || 'Match',
    selectionType: selection.selectionType || 'HOME',
    selectionValue: selection.selectionValue || selection.pick || '1',
    odds: parseFloat(selection.odds) || 1,
    score: null,
    result: 'PENDING'
  }));

  const bookingCode = await bookingCodeRepository.create({
    code,
    userId: userId || null,
    selections: selectionsJSON,
    expiresAt,
    status: 'ACTIVE'
  });

  console.log('✅ Booking code created silently:', bookingCode.id);
  console.log('✅ Selections count:', selectionsJSON.length);

  return {
    bookingCodeId: bookingCode.id,
    bookingCode: bookingCode.code,
    selections: selectionsJSON
  };
};

/**
 * Validate bet selections
 */
const validateSelections = (selections) => {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new ValidationError('At least one selection is required');
  }

  selections.forEach((selection, index) => {
    if (!selection.matchId || !selection.odds) {
      throw new ValidationError(`Selection ${index + 1} is missing required fields`);
    }
    
    const odds = parseFloat(selection.odds);
    if (isNaN(odds) || odds <= 1) {
      throw new ValidationError(`Invalid odds value for selection ${index + 1}`);
    }

    if (!selection.selectionValue || !['HOME', 'DRAW', 'AWAY', 'OVER', 'UNDER', 'YES', 'NO'].includes(selection.selectionType)) {
      throw new ValidationError(`Selection ${index + 1} has invalid selection type or value`);
    }
  });

  return true;
};

/**
 * Calculate total odds from selections
 */
const calculateTotalOdds = (selections) => {
  return selections.reduce((product, selection) => {
    return product * parseFloat(selection.odds);
  }, 1);
};

/**
 * Place a new bet
 * - Kama bookingCodeId INAPO → Tumia existing booking code na selections zake
 * - Kama HAKUNA → Unda booking code na selections SILENTLY
 */
const placeBet = async (userId, selections, stake, bookingCodeId = null) => {
  console.log('=== PLACE BET REQUEST ===');
  console.log('UserId:', userId);
  console.log('BookingCodeId:', bookingCodeId);
  console.log('Stake:', stake);
  console.log('Selections count:', selections?.length);
  console.log('Selections:', JSON.stringify(selections, null, 2));
  
  // Validate inputs
  if (!userId) throw new ValidationError('User ID is required');
  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    throw new ValidationError('At least one selection is required');
  }
  if (!stake || stake <= 0) throw new ValidationError('Valid stake amount is required');
  if (stake < 100) throw new ValidationError('Minimum stake is 100 Tsh');

  // Get user and check balance
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  if (parseFloat(user.balance) < stake) {
    throw new InsufficientBalanceError(`Insufficient balance. Need TZS ${stake} but have TZS ${user.balance}`);
  }

  let finalBookingCodeId = bookingCodeId;
  let finalSelections = [];

  // ============================================================
  // SCENARIO 1: User ameLOAD booking code (bookingCodeId INAPO)
  // ============================================================
  if (bookingCodeId) {
    console.log('🔍 Scenario 1: User loaded booking code. Verifying...');
    
    const bookingCode = await bookingCodeRepository.findById(bookingCodeId);
    if (!bookingCode) {
      throw new NotFoundError('Booking code not found');
    }

    if (bookingCode.status !== 'ACTIVE') {
      throw new ValidationError('Booking code is not active');
    }

    const now = new Date();
    if (now > bookingCode.expiresAt) {
      throw new ValidationError('Booking code has expired');
    }
    
    finalSelections = bookingCode.selections || [];
    
    console.log('✅ Booking code verified');
    console.log('✅ Selections count:', finalSelections.length);
    
  // ============================================================
  // SCENARIO 2: User hajaload booking code (HAKUNA bookingCodeId)
  // ============================================================
  } else {
    console.log('🔄 Scenario 2: No booking code provided. Creating silently...');
    
    validateSelections(selections);
    
    const result = await createBookingCodeSilently(userId, selections);
    finalBookingCodeId = result.bookingCodeId;
    finalSelections = result.selections;
    
    console.log('✅ Auto-created booking code:', result.bookingCode);
    console.log('✅ Auto-created booking code ID:', result.bookingCodeId);
  }

  // Calculate total odds from selections
  const totalOdds = calculateTotalOdds(finalSelections);
  const potentialReturn = stake * totalOdds;
  
  console.log('Calculated - Total Odds:', totalOdds, 'Potential Return:', potentialReturn);

  // ============================================================
  // UNDA BET - HAKUNA selectionId
  // ============================================================
  const bet = await betRepository.create({
    userId,
    bookingCodeId: finalBookingCodeId,
    stake,
    totalOdds,
    potentialReturn,
    status: 'OPEN',
    result: 'PENDING'
  });

  // Deduct stake from user balance
  await userRepository.deductBalance(userId, stake);
  console.log(`Deducted ${stake} from user ${userId} balance`);

  console.log('Bet placed successfully:', bet.id);
  console.log('========================');

  return {
    bet,
    bookingCodeId: finalBookingCodeId,
    selections: finalSelections,
    totalSelections: finalSelections.length,
    totalOdds,
    potentialReturn
  };
};

module.exports = {
  placeBet
};