const { Match } = require('../../../models');
const { settlePendingBets } = require('./betSettlement.service');
const { Op } = require('sequelize');

/**
 * Main engine processing function run by cron / interval
 * @param {Object} io - Socket.io instance to broadcast live updates
 */
const processLiveMatches = async (io) => {
  const now = new Date();

  // A. ANZA MECHI (UPCOMING -> LIVE)
  const upcomingMatches = await Match.findAll({
    where: { status: 'UPCOMING' }
  });

  for (const match of upcomingMatches) {
    const matchDateTime = new Date(`${match.date} ${match.time}`);
    if (now >= matchDateTime) {
      match.status = 'LIVE';
      await match.save();

      console.log(`[ENGINE] Mechi ${match.home_team} vs ${match.away_team} imeanza (LIVE)!`);

      if (io) {
        io.emit('match_status_change', {
          match_id: match.id,
          status: 'LIVE',
          match_data: match
        });
      }
    }
  }

  // B. SHUGHULIKIA MECHI ZINAZOCHEEZWA (LIVE -> FINISHED)
  const liveMatches = await Match.findAll({ where: { status: 'LIVE' } });

  for (const match of liveMatches) {
    const matchStart = new Date(`${match.date} ${match.time}`);
    const elapsedMinutes = Math.floor((now - matchStart) / (1000 * 60)); // Minutes elapsed

    const ftExtra = match.predetermined_script?.extra_time_mins?.ft || 3;
    const totalMatchDuration = 90 + ftExtra;

    if (elapsedMinutes >= totalMatchDuration) {
      // MECHI IMEMALIZIKA!
      match.status = 'FINISHED';
      if (match.predetermined_script?.final_ft) {
        match.current_score = {
          home: match.predetermined_script.final_ft.homeScore,
          away: match.predetermined_script.final_ft.awayScore
        };
      }
      await match.save();

      console.log(`[ENGINE] Mechi ${match.home_team} vs ${match.away_team} IMEMALIZIKA!`);

      if (io) {
        io.emit('match_finished', {
          match_id: match.id,
          final_score: match.current_score
        });
      }

      // TRIGGER BET SETTLEMENT!
      await settlePendingBets(match.id);
    } else {
      // MECHI INAENDELEA: UPDATE SCORE & ELAPSED MINUTE
      const timeline = match.predetermined_script?.events_timeline || [];

      // Update current score from timeline events that occurred at/before elapsedMinutes
      const pastEvents = timeline.filter(e => parseFloat(e.minute) <= elapsedMinutes);
      if (pastEvents.length > 0) {
        const latestEvent = pastEvents[pastEvents.length - 1];
        if (latestEvent.current_score) {
          match.current_score = latestEvent.current_score;
        }
      }

      await match.save();

      // Emit live updates including exact minute
      if (io) {
        io.emit('match_score_update', {
          match_id: match.id,
          current_score: match.current_score,
          elapsed_minute: elapsedMinutes < 0 ? 0 : elapsedMinutes
        });
      }
    }
  }
};

module.exports = { processLiveMatches };