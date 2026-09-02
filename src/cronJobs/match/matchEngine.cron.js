const cron = require('node-cron');
const { Match } = require('../../models');
const { settlePendingBets, settleAllEligibleOpenBets } = require('../../services/bet/croneJob/betSettlement.service');

// --- SETTLEMENT ENGINE ---
// Settlement inaendeshwa na betSettlement.service.js (inayolinda OPEN/SETTLED + result WON/LOST)

// --- 3. CORE CRON ENGINE PROCESSOR ---
const processMatchesLifecycle = async (io = null) => {
  try {
    const activeMatches = await Match.findAll({
      where: { status: ['UPCOMING', 'LIVE'] }
    });

    const now = new Date();

    for (const match of activeMatches) {
      // Per-match guard: hitilafu kwenye mechi moja haisimamishe zingine
      try {
        if (!match.time || !match.date) continue;

        // PARSE TIME (e.g., "11:00 am" -> Date Object)
        const timeParts = match.time.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
        if (!timeParts) continue;

        let hours = parseInt(timeParts[1], 10);
        const minutes = parseInt(timeParts[2], 10);
        if (timeParts[3] === 'pm' && hours < 12) hours += 12;
        if (timeParts[3] === 'am' && hours === 12) hours = 0;

        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

        // Robust timestamp parsing (date inaweza kuwa "2026-09-02", "02/09/2026",
        // "2/9/2026", "Sep 2 2026" n.k.) — EPUKA Invalid Date.
        let matchStartTime = new Date(`${match.date}T${timeStr}`);
        if (isNaN(matchStartTime.getTime())) {
          matchStartTime = new Date(`${match.date} ${timeStr}`);
        }
        if (isNaN(matchStartTime.getTime())) {
          matchStartTime = new Date(match.date);
          if (!isNaN(matchStartTime.getTime()) && hours !== undefined) {
            matchStartTime.setHours(hours, minutes, 0, 0);
          }
        }
        if (isNaN(matchStartTime.getTime())) {
          console.warn(`[MATCH ENGINE] Skipping mechi ${match.id}: date/time isivalidi (${match.date} ${match.time})`);
          continue;
        }

        const elapsedMinutes = Math.floor((now - matchStartTime) / (1000 * 60));

        // 🧪 DEBUG LOG: Angalia kila mechi ya UPCOMING ikiwa imefika muda wa kucheza
        if (match.status === 'UPCOMING') {
          console.log(`[MATCH ENGINE] CHECK: "${match.home_team} vs ${match.away_team}" | date=${match.date} time=${match.time} | start=${matchStartTime.toISOString()} | elapsedMin=${elapsedMinutes} | status=${match.status}`);
        }

      // STATE 1: UPCOMING -> LIVE
      if (match.status === 'UPCOMING' && elapsedMinutes >= 0) {
        await match.update({
          status: 'LIVE',
          current_score: { home: 0, away: 0 }
        });
        console.log(`[MATCH ENGINE] Mechi ID ${match.id} (${match.home_team} vs ${match.away_team}) ipo LIVE!`);

        if (io) {
          io.emit('match_status_change', {
            match_id: match.id,
            status: 'LIVE',
            match_data: match
          });

          io.emit('match_score_update', {
            match_id: match.id,
            current_score: { home: 0, away: 0 },
            elapsed_minute: 0
          });
        }
      }

      // STATE 2: LIVE SCORE UPDATES VIA TIMELINE
      if (match.status === 'LIVE' || (match.status === 'UPCOMING' && elapsedMinutes >= 0)) {
        const timeline = match.predetermined_script?.events_timeline || [];
        
        const pastEvents = timeline.filter((evt) => {
          // 🟢 SAFE CONVERSION: Inahakikisha evt.minute ni String kabla ya split()
          const minStr = String(evt.minute ?? "0");
          const minuteNum = parseInt(minStr.split('+')[0], 10);
          return minuteNum <= elapsedMinutes;
        });

        const latestScore = pastEvents.length > 0
          ? pastEvents[pastEvents.length - 1].current_score
          : { home: 0, away: 0 };

        if (JSON.stringify(match.current_score) !== JSON.stringify(latestScore)) {
          await match.update({ current_score: latestScore });

          if (io) {
            io.emit('match_score_update', {
              match_id: match.id,
              current_score: latestScore,
              elapsed_minute: elapsedMinutes
            });
          }
        }

        // STATE 3: LIVE -> FINISHED (FT)
        if (elapsedMinutes >= 90) {
          const script = match.predetermined_script || {};
          const finalScore = script.final_ft || {
            homeScore: latestScore.home || 0,
            awayScore: latestScore.away || 0
          };

          await match.update({
            status: 'FINISHED',
            current_score: { home: finalScore.homeScore, away: finalScore.awayScore }
          });

          console.log(`[MATCH ENGINE] Mechi ${match.id} imemalizika FT (${finalScore.homeScore}-${finalScore.awayScore})`);

          // Settle Bets Zote Za Mechi Hii (kupitia betSettlement.service)
          // Guard pekee: kama settlement inashindikana, mechi nyingine ziendelee.
          try {
            await settlePendingBets(match.id);
          } catch (settleErr) {
            console.error(`[MATCH ENGINE] Settlement error kwa mechi ${match.id}:`, settleErr.message);
          }

          if (io) {
            io.emit('match_finished', {
              match_id: match.id,
              final_score: finalScore
            });
          }
        }
      }
      } catch (matchErr) {
        console.error(`[MATCH ENGINE] Error kwenye mechi ${match.id} (${match.home_team} vs ${match.away_team}):`, matchErr.message);
      }
    }
  } catch (error) {
    console.error('[CRON ENGINE ERROR]:', error);
  }
};

// --- 4. START SCHEDULER ---
const startMatchCronJob = (io = null) => {
  // Inakimbia kila dakika 1
  cron.schedule('* * * * *', async () => {
    console.log('[CRON ENGINE] Checking Match Lifecycles & Settlements...');
    await processMatchesLifecycle(io);

    // RECOVERY SWEEP: Hushughulikia mikeka OPEN ambayo mechi zake
    // zimekamilika lakini hazijasettled (mf: server ilikuwa mbali).
    await settleAllEligibleOpenBets();
  });

  // Pia sweep mapema mara server inapoanza (fix ya bets zilizostuck)
  setTimeout(() => {
    console.log('[CRON ENGINE] Running initial recovery sweep...');
    settleAllEligibleOpenBets();
  }, 3000);
};

module.exports = {
  startMatchCronJob,
  processMatchesLifecycle
};