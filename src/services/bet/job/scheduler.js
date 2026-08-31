// jobs/scheduler.js
const cron = require('node-cron');
const { processLiveMatches } = require('../croneJob/matchEngine.service');



const initScheduler = () => {
  console.log('⏰ [CRON] Match Automation Scheduler initialized.');

  cron.schedule('* * * * *', async () => {
    console.log('🔄 [CRON] Checking live matches & pending bets...');
    try {
      await processLiveMatches();
    } catch (err) {
      console.error('❌ [CRON ERROR]', err);
    }
  });
};

module.exports = { initScheduler };