require('dotenv').config();
(async () => {
  const { sequelize } = require('./models');
  const { QueryTypes } = require('sequelize');
  const userRepo = require('./repositories/user/user.repository');
  const matchRepo = require('./repositories/match/match.repository');
  const { placeBet } = require('./services/bet/betting.service');
  const { settlePendingBets } = require('./services/bet/croneJob/betSettlement.service');
  const MATCH_ID = '0ac5b6e7-dd0b-47a4-9ada-e9f53c447812';

  const user = await userRepo.findByPhone('255700100099');
  console.log('USER:', user.phone_number, '| balance before:', user.balance);

  const match = await matchRepo.findMatchById(MATCH_ID);
  const matched = parseFloat(match.odds['1X2']['1']);
  console.log('MATCH:', match.home_team, 'vs', match.away_team, '| odds 1X2/1:', matched);

  const before = parseFloat(user.balance);
  const bet = await placeBet(user.id, {
    stake: 5000,
    selections: [{ match_id: MATCH_ID, market_key: '1X2', outcome_key: '1' }]
  });
  console.log('BET PLACED:', bet.ticket_code, '| payout:', bet.payout);

  await sequelize.query(`UPDATE matches SET status='FINISHED', current_score=JSON_OBJECT('home',3,'away',1) WHERE id=?`, { replacements: [MATCH_ID] });
  await settlePendingBets(MATCH_ID);

  const afterUser = await userRepo.findByPhone('255700100099');
  console.log('USER balance after settle:', afterUser.balance, '| credited:', (parseFloat(afterUser.balance) - before).toFixed(2));

  const notifs = await sequelize.query(
    `SELECT id, type, title, message, is_read, metadata FROM notifications WHERE user_id=? ORDER BY createdAt DESC LIMIT 3`,
    { replacements: [user.id], type: QueryTypes.SELECT });
  console.log('');
  console.log('--- LATEST NOTIFICATIONS ---');
  notifs.forEach(n => console.log('[' + n.type + '] ' + n.title + ' :: ' + n.message + ' :: meta=' + JSON.stringify(n.metadata)));

  const win = notifs.find(n => n.metadata && n.metadata.type === 'bet_win');
  console.log('');
  console.log('WIN NOTIFICATION FOUND:', win ? 'YES' : 'NO');
  await sequelize.query(`UPDATE matches SET status='UPCOMING', current_score=JSON_OBJECT('home',0,'away',0) WHERE id=?`, { replacements: [MATCH_ID] });
  process.exit(0);
})();
