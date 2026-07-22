// services/selections/selection.service.js

const selectionRepository = require('../../repositories/selections/selection.repository');
const betService = require('../bets/bet.service');
const { ValidationError, NotFoundError } = require('../../utils/errors');

/**
 * Create a new selection
 */
const createSelection = async (selectionData) => {
  if (!selectionData.bookingCodeId) {
    throw new ValidationError('Booking code ID is required');
  }
  if (!selectionData.matchId) {
    throw new ValidationError('Match ID is required');
  }
  if (!selectionData.selectionType || !selectionData.selectionValue) {
    throw new ValidationError('Selection type and value are required');
  }
  if (!selectionData.odds || parseFloat(selectionData.odds) <= 1) {
    throw new ValidationError('Valid odds (>1) are required');
  }

  return await selectionRepository.create(selectionData);
};

/**
 * Create multiple selections
 */
const createMultipleSelections = async (selectionsData) => {
  if (!Array.isArray(selectionsData) || selectionsData.length === 0) {
    throw new ValidationError('At least one selection is required');
  }

  // Validate all selections
  selectionsData.forEach((selection, index) => {
    if (!selection.bookingCodeId) {
      throw new ValidationError(`Selection ${index + 1}: Booking code ID is required`);
    }
    if (!selection.matchId) {
      throw new ValidationError(`Selection ${index + 1}: Match ID is required`);
    }
    if (!selection.selectionType || !selection.selectionValue) {
      throw new ValidationError(`Selection ${index + 1}: Selection type and value are required`);
    }
    if (!selection.odds || parseFloat(selection.odds) <= 1) {
      throw new ValidationError(`Selection ${index + 1}: Valid odds (>1) are required`);
    }
  });

  return await selectionRepository.bulkCreate(selectionsData);
};

/**
 * Get selection by ID
 */
const getSelectionById = async (id) => {
  if (!id) throw new ValidationError('Selection ID is required');

  const selection = await selectionRepository.findById(id);
  if (!selection) throw new NotFoundError('Selection not found');

  return selection;
};

/**
 * Get all selections by booking code
 */
const getSelectionsByBookingCode = async (bookingCodeId) => {
  if (!bookingCodeId) throw new ValidationError('Booking code ID is required');

  return await selectionRepository.findByBookingCodeId(bookingCodeId);
};

/**
 * Update selection score (home and away)
 */
const updateSelectionScore = async (id, homeScore, awayScore) => {
  if (!id) throw new ValidationError('Selection ID is required');
  if (homeScore === undefined || awayScore === undefined) {
    throw new ValidationError('Home score and away score are required');
  }
  if (homeScore < 0 || awayScore < 0) {
    throw new ValidationError('Scores cannot be negative');
  }

  const selection = await selectionRepository.updateScore(id, homeScore, awayScore);
  if (!selection) throw new NotFoundError('Selection not found');

  return selection;
};

/**
 * Update selection score and auto-settle bets based on result
 */
const updateScoreAndSettle = async (id, homeScore, awayScore) => {
  if (!id) throw new ValidationError('Selection ID is required');
  if (homeScore === undefined || awayScore === undefined) {
    throw new ValidationError('Home score and away score are required');
  }
  if (homeScore < 0 || awayScore < 0) {
    throw new ValidationError('Scores cannot be negative');
  }

  // Get selection
  const selection = await selectionRepository.findById(id);
  if (!selection) throw new NotFoundError('Selection not found');

  // Determine result based on selection type and scores
  let result = 'PENDING';
  
  switch (selection.selectionType) {
    case 'HOME':
      result = homeScore > awayScore ? 'WON' : 'LOST';
      break;
    case 'DRAW':
      result = homeScore === awayScore ? 'WON' : 'LOST';
      break;
    case 'AWAY':
      result = awayScore > homeScore ? 'WON' : 'LOST';
      break;
    case 'OVER':
      // Assuming OVER 2.5 - can be customized
      const overThreshold = parseFloat(selection.selectionValue) || 2.5;
      const totalGoals = homeScore + awayScore;
      result = totalGoals > overThreshold ? 'WON' : 'LOST';
      break;
    case 'UNDER':
      const underThreshold = parseFloat(selection.selectionValue) || 2.5;
      const totalGoalsUnder = homeScore + awayScore;
      result = totalGoalsUnder < underThreshold ? 'WON' : 'LOST';
      break;
    case 'YES':
      // Both teams to score
      result = (homeScore > 0 && awayScore > 0) ? 'WON' : 'LOST';
      break;
    case 'NO':
      // Both teams to score - NO
      result = (homeScore === 0 || awayScore === 0) ? 'WON' : 'LOST';
      break;
    default:
      result = 'PENDING';
  }

  // Update selection with score and result
  const updatedSelection = await selectionRepository.updateScoreAndResult(
    id, 
    homeScore, 
    awayScore, 
    result
  );

  // If result is determined (WON or LOST), settle all bets for this selection
  if (result !== 'PENDING') {
    const settlementResult = await betService.settleBetsBySelection(id, result);
    console.log(`Settled ${settlementResult.totalSettled} bets for selection ${id}`);
  }

  return {
    selection: updatedSelection,
    result: result,
    betsSettled: result !== 'PENDING' ? true : false
  };
};

/**
 * Bulk update scores for multiple selections
 */
const bulkUpdateScores = async (selectionsData) => {
  // selectionsData = [{ id, homeScore, awayScore }, ...]
  
  if (!Array.isArray(selectionsData) || selectionsData.length === 0) {
    throw new ValidationError('At least one selection score update is required');
  }

  const results = [];
  const errors = [];

  for (const data of selectionsData) {
    try {
      const { id, homeScore, awayScore } = data;
      
      if (!id) {
        errors.push({ data, error: 'Selection ID is required' });
        continue;
      }
      
      if (homeScore === undefined || awayScore === undefined) {
        errors.push({ id, error: 'Home score and away score are required' });
        continue;
      }

      const updated = await selectionRepository.updateScore(id, homeScore, awayScore);
      
      if (!updated) {
        errors.push({ id, error: 'Selection not found' });
      } else {
        results.push(updated);
      }
    } catch (error) {
      errors.push({ id: data.id, error: error.message });
    }
  }

  return {
    updated: results,
    errors: errors,
    totalUpdated: results.length,
    totalErrors: errors.length
  };
};

/**
 * Get selections by result status
 */
const getSelectionsByResult = async (result, options = {}) => {
  if (!result) throw new ValidationError('Result is required');
  if (!['PENDING', 'WON', 'LOST'].includes(result)) {
    throw new ValidationError('Invalid result status');
  }

  return await selectionRepository.findByResult(result, options);
};

/**
 * Get pending selections (not settled yet)
 */
const getPendingSelections = async () => {
  return await selectionRepository.findPendingSelections();
};

/**
 * Get selections by match name (search)
 */
const searchSelectionsByMatch = async (searchTerm) => {
  if (!searchTerm || searchTerm.length < 2) {
    throw new ValidationError('Search term must be at least 2 characters');
  }

  return await selectionRepository.findByMatchName(searchTerm);
};

/**
 * Manually settle a selection (admin function)
 */
const settleSelection = async (id, result) => {
  if (!id) throw new ValidationError('Selection ID is required');
  if (!['WON', 'LOST'].includes(result)) {
    throw new ValidationError('Result must be WON or LOST');
  }

  const selection = await selectionRepository.updateResult(id, result);
  if (!selection) throw new NotFoundError('Selection not found');

  // Settle all bets for this selection
  const settlementResult = await betService.settleBetsBySelection(id, result);

  return {
    selection: selection,
    betsSettled: settlementResult.totalSettled
  };
};

/**
 * Get selection statistics
 */
const getSelectionStats = async (bookingCodeId) => {
  if (!bookingCodeId) throw new ValidationError('Booking code ID is required');

  const selections = await selectionRepository.findByBookingCodeId(bookingCodeId);
  
  const stats = {
    total: selections.length,
    pending: 0,
    won: 0,
    lost: 0,
    settled: 0
  };

  selections.forEach(selection => {
    if (selection.result === 'PENDING') stats.pending++;
    else if (selection.result === 'WON') stats.won++;
    else if (selection.result === 'LOST') stats.lost++;
    
    if (selection.isSettled) stats.settled++;
  });

  return stats;
};

/**
 * Delete a selection
 */
const deleteSelection = async (id) => {
  if (!id) throw new ValidationError('Selection ID is required');

  // Check if selection has bets
  const selection = await selectionRepository.findById(id);
  if (!selection) throw new NotFoundError('Selection not found');

  if (selection.bets && selection.bets.length > 0) {
    throw new ValidationError('Cannot delete selection with existing bets');
  }

  return await selectionRepository.deleteSelection(id);
};

module.exports = {
  createSelection,
  createMultipleSelections,
  getSelectionById,
  getSelectionsByBookingCode,
  updateSelectionScore,
  updateScoreAndSettle,
  bulkUpdateScores,
  getSelectionsByResult,
  getPendingSelections,
  searchSelectionsByMatch,
  settleSelection,
  getSelectionStats,
  deleteSelection
};