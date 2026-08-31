// services/match/matchEngine.service.js
const { Match } = require('../../../models');
const { settlePendingBets } = require('./betSettlement.service');
const { Op } = require('sequelize');

const processLiveMatches = async () => {
  const now = new Date();
  
  // A. ANZA MECHI (UPCOMING -> LIVE)
  // Inatafuta mechi za UPCOMING ambazo tarehe na muda wake umewadia au kupita
  const upcomingMatches = await Match.findAll({
    where: {
      status: 'UPCOMING',
      // Mfano: unacompare date & time strings au JS Date Object
    }
  });

  for (const match of upcomingMatches) {
    const matchDateTime = new Date(`${match.date} ${match.time}`);
    if (now >= matchDateTime) {
      match.status = 'LIVE';
      await match.save();
      console.log(`[ENGINE] Mechi ${match.home_team} vs ${match.away_team} imeanza (LIVE)!`);
    }
  }

  // B. SHUGHULIKIA MECHI ZINAZOCHEEZWA (LIVE -> FINISHED)
  const liveMatches = await Match.findAll({ where: { status: 'LIVE' } });

  for (const match of liveMatches) {
    const matchStart = new Date(`${match.date} ${match.time}`);
    const elapsedMinutes = Math.floor((now - matchStart) / (1000 * 60)); // Dakika zilizopita tangu kuanza

    const totalMatchDuration = 90 + match.predetermined_script.extra_time_mins.ft;

    if (elapsedMinutes >= totalMatchDuration) {
      // MECHI IMEMALIZIKA!
      match.status = 'FINISHED';
      match.current_score = {
        home: match.predetermined_script.final_ft.homeScore,
        away: match.predetermined_script.final_ft.awayScore
      };
      await match.save();

      console.log(`[ENGINE] Mechi ${match.home_team} vs ${match.away_team} IMEMALIZIKA! Settle Bets...`);
      
      // TRIGGER BET SETTLEMENT!
      await settlePendingBets(match.id);
    } else {
      // MECHI INAENDELEA: UPDATE CURRENT SCORE KULINGANA NA TIMELINE!
      const timeline = match.predetermined_script.events_timeline;
      
      // Tafuta tukio la mwisho lililotokea ndani ya dakika hii
      const pastEvents = timeline.filter(e => parseFloat(e.minute) <= elapsedMinutes);
      if (pastEvents.length > 0) {
        const latestEvent = pastEvents[pastEvents.length - 1];
        match.current_score = latestEvent.current_score;
        await match.save();
      }
    }
  }
};

module.exports = { processLiveMatches };