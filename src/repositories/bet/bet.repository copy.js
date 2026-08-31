const { Bet, BetSelection, Match } = require('../../models');

const findBetById = async (id, transaction = null) => {
  return await Bet.findByPk(id, {
    include: [
      {
        model: BetSelection,
        as: 'selections',
        include: [{ model: Match, as: 'match' }]
      }
    ],
    transaction
  });
};

const createBet = async (betData, selectionsData, transaction = null) => {
  const bet = await Bet.create(betData, { transaction });

  const selectionsWithBetId = selectionsData.map(item => ({
    ...item,
    bet_id: bet.id
  }));

  await BetSelection.bulkCreate(selectionsWithBetId, { transaction });

  return await findBetById(bet.id, transaction);
};

const findBetByTicketCode = async (ticketCode) => {
  return await Bet.findOne({
    where: { ticket_code: ticketCode },
    include: [{ model: BetSelection, as: 'selections' }]
  });
};

const findBetsByUserId = async (userId, options = {}) => {
  return await Bet.findAll({
    where: { user_id: userId },
    include: [
      {
        model: BetSelection,
        as: 'selections',
        include: [{ model: Match, as: 'match' }]
      }
    ],
    order: [['createdAt', 'DESC']],
    ...options
  });
};

const updateBetStatus = async (betId, status, transaction = null) => {
  const [updatedRows] = await Bet.update(
    { status },
    { where: { id: betId }, transaction }
  );
  return updatedRows > 0;
};

const updateBetSelectionStatus = async (selectionId, status, transaction = null) => {
  const [updatedRows] = await BetSelection.update(
    { status },
    { where: { id: selectionId }, transaction }
  );
  return updatedRows > 0;
};

module.exports = {
  createBet,
  findBetById,
  findBetByTicketCode,
  findBetsByUserId,
  updateBetStatus,
  updateBetSelectionStatus
};