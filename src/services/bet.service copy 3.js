// services/bet.service.js
const betRepository = require('../repositories/bet.repository');
const userRepository = require('../repositories/user.repository');
const {
  ValidationError,
  NotFoundError,
  InsufficientBalanceError
} = require('../utils/errors');

/**
 * Generate unique booking code
 */
// const generateBookingCode = () => {
//   const prefix = 'BET';
//   const timestamp = Date.now().toString(36).toUpperCase();
//   const random = Math.random().toString(36).substring(2, 8).toUpperCase();
//   return `${prefix}${timestamp}${random}`;
// };

const generateBookingCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

/**
 * Validate bet selections
 */
const validateSelections = (selections) => {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new ValidationError('At least one selection is required');
  }

  // Check each selection has required fields
  selections.forEach((selection, index) => {
    if (!selection.match || !selection.selection || !selection.odds) {
      throw new ValidationError(`Selection ${index + 1} is missing required fields`);
    }
    
    const odds = parseFloat(selection.odds);
    if (isNaN(odds) || odds <= 1) {
      throw new ValidationError(`Invalid odds value for selection ${index + 1}`);
    }

    if (!['1', 'X', '2'].includes(selection.selection)) {
      throw new ValidationError(`Selection ${index + 1} must be 1, X, or 2`);
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
 */
const placeBet = async (userId, selections, stake) => {
  // Validate inputs
  if (!userId) throw new ValidationError('User ID is required');
  if (!stake || stake <= 0) throw new ValidationError('Valid stake amount is required');
  
  validateSelections(selections);

  // Check if stake is at least 100
  if (stake < 100) {
    throw new ValidationError('Minimum stake is 100 Tsh');
  }

  // Get user and check balance
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  // Check if user has sufficient balance
  if (parseFloat(user.balance) < stake) {
    throw new InsufficientBalanceError('Insufficient balance to place bet');
  }

  // Calculate total odds and potential return
  const totalOdds = calculateTotalOdds(selections);
  const potentialReturn = stake * totalOdds;

  // Generate unique booking code
  let bookingCode;
  let isUnique = false;
  
  while (!isUnique) {
    bookingCode = generateBookingCode();
    const exists = await betRepository.bookingCodeExists(bookingCode);
    if (!exists) isUnique = true;
  }

  // Create bet record
  const bet = await betRepository.create({
    bookingCode,
    userId,
    selections: JSON.stringify(selections),
    stake,
    totalOdds,
    potentialReturn,
    status: 'OPEN',
    result: 'PENDING',
    isBookingCodeActive: true
  });

  // Deduct stake from user balance
  await userRepository.deductBalance(userId, stake);

  // Return bet with parsed selections
  const betData = bet.toJSON();
  betData.selections = JSON.parse(betData.selections);

  return betData;
};

/**
 * Load bet by booking code
 */
const loadBetByBookingCode = async (bookingCode) => {
  if (!bookingCode) throw new ValidationError('Booking code is required');

  // Search for active bet ONLY (OPEN + PENDING)
  const bet = await betRepository.findActiveByBookingCode(bookingCode);
  
  if (!bet) {
    // Check if bet exists but is not active
    const existingBet = await betRepository.findByBookingCode(bookingCode);
    
    if (!existingBet) {
      throw new NotFoundError('Booking code not found');
    }
    
    // Provide specific error message based on bet status
    if (existingBet.status === 'SETTLED') {
      throw new ValidationError('This bet has already been settled and cannot be loaded');
    }
    
    if (existingBet.result === 'WON' || existingBet.result === 'LOST') {
      throw new ValidationError('This bet has already been resolved and cannot be loaded');
    }
    
    if (!existingBet.isBookingCodeActive) {
      throw new ValidationError('This booking code is no longer active');
    }
    
    throw new ValidationError('This bet is no longer available for loading');
  }

  // Parse selections from JSON
  const betData = bet.toJSON();
  betData.selections = JSON.parse(betData.selections);

  return betData;
};

/**
 * Settle bet (update result)
 */
const settleBet = async (betId, result) => {
  if (!betId) throw new ValidationError('Bet ID is required');
  if (!['WON', 'LOST'].includes(result)) {
    throw new ValidationError('Result must be WON or LOST');
  }

  const bet = await betRepository.findById(betId);
  if (!bet) throw new NotFoundError('Bet not found');

  if (bet.status !== 'OPEN') {
    throw new ValidationError('Only OPEN bets can be settled');
  }

  if (bet.result !== 'PENDING') {
    throw new ValidationError('Bet already has a result');
  }

  // Update bet
  const updatedBet = await betRepository.settleBet(betId, result);

  // If bet was WON, credit winnings to user
  if (result === 'WON') {
    await userRepository.addBalance(bet.userId, bet.potentialReturn);
  }

  const betData = updatedBet.toJSON();
  betData.selections = JSON.parse(betData.selections);

  return betData;
};

/**
 * Get user's bets
 */
const getUserBets = async (userId, options = {}) => {
  if (!userId) throw new ValidationError('User ID is required');

  const { bets, count } = await betRepository.findByUserId(userId, options);

  // Parse selections for each bet
  const formattedBets = bets.map(bet => {
    const betData = bet.toJSON();
    betData.selections = JSON.parse(betData.selections);
    return betData;
  });

  return {
    total: count,
    bets: formattedBets
  };
};

/**
 * Generate new booking code for existing bet
 */
const generateNewBookingCode = async (betId) => {
  const bet = await betRepository.findById(betId);
  if (!bet) throw new NotFoundError('Bet not found');

  if (bet.status !== 'OPEN' || bet.result !== 'PENDING') {
    throw new ValidationError('Cannot generate booking code for settled bet');
  }

  // Generate new unique booking code
  let newBookingCode;
  let isUnique = false;
  
  while (!isUnique) {
    newBookingCode = generateBookingCode();
    const exists = await betRepository.bookingCodeExists(newBookingCode);
    if (!exists) isUnique = true;
  }

  // Update bet with new booking code
  await betRepository.update(betId, { 
    bookingCode: newBookingCode,
    isBookingCodeActive: true 
  });

  return { bookingCode: newBookingCode };
};

/**
 * Get bet by ID
 */
const getBetById = async (betId) => {
  if (!betId) throw new ValidationError('Bet ID is required');

  const bet = await betRepository.findById(betId);
  if (!bet) throw new NotFoundError('Bet not found');

  const betData = bet.toJSON();
  betData.selections = JSON.parse(betData.selections);

  return betData;
};

/**
 * Cancel bet
 */
const cancelBet = async (betId, userId) => {
  const bet = await betRepository.findById(betId);
  if (!bet) throw new NotFoundError('Bet not found');

  if (bet.status !== 'OPEN') {
    throw new ValidationError('Only OPEN bets can be cancelled');
  }

  // Refund stake to user
  await userRepository.addBalance(userId, bet.stake);

  const cancelledBet = await betRepository.cancelBet(betId);

  const betData = cancelledBet.toJSON();
  betData.selections = JSON.parse(betData.selections);

  return betData;
};

/**
 * Get user bet statistics
 */
const getUserBetStats = async (userId) => {
  if (!userId) throw new ValidationError('User ID is required');

  const stats = await betRepository.getUserBetStats(userId);
  
  return {
    totalBets: parseInt(stats.totalBets) || 0,
    totalStake: parseFloat(stats.totalStake) || 0,
    totalPotentialReturn: parseFloat(stats.totalPotentialReturn) || 0,
    wonBets: parseInt(stats.wonBets) || 0,
    lostBets: parseInt(stats.lostBets) || 0,
    totalWon: parseFloat(stats.totalWon) || 0,
    winRate: parseInt(stats.totalBets) > 0 
      ? ((parseInt(stats.wonBets) / parseInt(stats.totalBets)) * 100).toFixed(2)
      : 0
  };
};



// APPROVE / SETTLE BET
const approveBet = async (betId, resultStatus) => {

  const bet = await betRepository.findById(betId);

  if (!bet) {
    throw new Error("Bet not found");
  }

  if (bet.status === "SETTLED") {
    throw new Error("Bet already settled");
  }

  // Determine result
  let result;
  if (resultStatus === "WON") {
    result = "WON";
  } else if (resultStatus === "LOST") {
    result = "LOST";
  } else {
    throw new Error("Invalid result type");
  }

  // Update bet
  bet.result = result;
  bet.status = "SETTLED";

  await bet.save();

  return bet;
};




module.exports = {
  placeBet,
  approveBet,
  loadBetByBookingCode,
  settleBet,
  getUserBets,
  generateNewBookingCode,
  getBetById,
  cancelBet,
  getUserBetStats
};