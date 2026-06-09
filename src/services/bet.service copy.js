const betRepository = require('../repositories/bet.repository');

const calculateTotalOdds = (matches) => {
  return matches.reduce((acc, match) => acc * parseFloat(match.odds), 1);
};

const formatResponse = (bet) => {

  const createdAt = new Date(bet.createdAt);

  return {
    id: bet.id,
    time: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: createdAt.toLocaleDateString(),
    result: bet.result,
    stake: bet.stake,
    total_odds: bet.total_odds,
    payout: bet.payout,
    currency: bet.currency,
    status: bet.status,
    details: {
      matches: bet.matches,
      betType: bet.bet_type
    }
  };
};

const createBet = async (data) => {

  const { stake, currency, bet_type, matches } = data;

  if (!matches || matches.length === 0) {
    throw new Error('Matches required');
  }

  const total_odds = calculateTotalOdds(matches);
  const payout = parseFloat(stake) * total_odds;

  const bet = await betRepository.createBet({
    stake,
    currency,
    bet_type,
    matches,
    total_odds,
    payout
  });

  return formatResponse(bet);
};

const getAllBets = async () => {
  const bets = await betRepository.findAllBets();
  return bets.map(formatResponse);
};

const getBetById = async (id) => {
  const bet = await betRepository.findBetById(id);
  if (!bet) throw new Error('Bet not found');
  return formatResponse(bet);
};

const updateBet = async (id, data) => {
    const bet = await betRepository.findBetById(id);
    if (!bet) throw new Error('Bet not found');
  
    let matches = bet.matches; // default to existing matches
  
    if (data.matches !== undefined) {
      // only parse if matches field is provided in update
      if (typeof data.matches === 'string') {
        try {
          matches = JSON.parse(data.matches);
        } catch (err) {
          throw new Error('Invalid matches JSON format');
        }
      } else if (Array.isArray(data.matches)) {
        matches = data.matches;
      } else {
        throw new Error('Matches must be an array');
      }
    }
  
    // stake: use updated stake if provided, else existing
    const stake = data.stake !== undefined ? parseFloat(data.stake) : parseFloat(bet.stake);
  
    // recalculate total_odds only if matches changed
    const total_odds = data.matches ? matches.reduce((acc, match) => acc * parseFloat(match.odds), 1) : bet.total_odds;
    const payout = stake * total_odds;
  
    const updatedData = {
      ...data,
      matches,
      stake,
      total_odds,
      payout
    };
  
    // Perform update
    await betRepository.updateBet(id, updatedData);
  
    // fetch updated object
    const updatedBet = await betRepository.findBetById(id);
  
    // ensure matches is array
    if (typeof updatedBet.matches === 'string') {
      updatedBet.matches = JSON.parse(updatedBet.matches);
    }
  
    return formatResponse(updatedBet);
  };

const deleteBet = async (id) => {

  const bet = await betRepository.findBetById(id);
  if (!bet) throw new Error('Bet not found');

  await betRepository.deleteBet(id);

  return { message: 'Bet deleted successfully' };
};

module.exports = {
  createBet,
  getAllBets,
  getBetById,
  updateBet,
  deleteBet
};