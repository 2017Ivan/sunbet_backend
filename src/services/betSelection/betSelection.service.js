
// services/betSelection/betSelection.service.js 
const betSelectionRepository = require('../repositories/betSelection.repository');

const getSelectionsByBetId = async (betId) => {
  return await betSelectionRepository.findSelectionsByBetId(betId);
};

const updateSelectionStatus = async (selectionId, status) => {
  const allowedStatuses = ['PENDING', 'WON', 'LOST', 'VOID'];
  if (!allowedStatuses.includes(status)) {
    throw new Error('Status ya selection si sahihi.');
  }

  const selection = await betSelectionRepository.findSelectionById(selectionId);
  if (!selection) {
    throw new Error('Selection haijapatikana.');
  }

  return await betSelectionRepository.updateStatus(selectionId, status);
};

module.exports = {
  getSelectionsByBetId,
  updateSelectionStatus
};