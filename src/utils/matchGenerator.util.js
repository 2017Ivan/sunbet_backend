// matchGenerator.util.js 
// Helper za Random Utilities
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const roundOdds = (val) => parseFloat(Math.max(1.01, val).toFixed(2));
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Bank ya Maelezo ya Matukio ya Mechi
const EVENT_TEMPLATES = {
  FOUL: [
    "Aggressive tackle in midfield to stop a quick counter",
    "Late sliding challenge on the wing",
    "Shirt pulling during a dangerous transition",
    "Pushing inside the box during an aerial duel",
    "Dangerous high boot challenge near the penalty arc"
  ],
  SHOT_OFF_TARGET: [
    "Long range rocket flies high over the crossbar",
    "Header goes wide of the left post from close range",
    "Volley dragged wide from outside the penalty box",
    "Free kick curled over the defensive wall and wide",
    "Curling effort inches away from reaching the top corner"
  ],
  SHOT_ON_TARGET: [
    "Stunning reflex save by goalkeeper to tip it over!",
    "Header saved right on the goal line by goalkeeper",
    "Low driving shot caught comfortably by keeper",
    "Powerful strike parried back into danger zone",
    "One-on-one strike blocked brilliantly by keeper's foot"
  ],
  CORNER: [
    "Inswinging corner punched away under pressure by keeper",
    "Corner cleared at the front post by defending backline",
    "Short corner routine intercepted by opposition",
    "Outswinging corner met by a powerful header over the bar"
  ],
  YELLOW_CARD: [
    "Tactical foul to break up a dangerous attack",
    "Late reckless sliding challenge",
    "Dissent and argument towards the referee",
    "Blatant time-wasting during throw-in/goal kick"
  ],
  SUBSTITUTION: [
    "Tactical change: Attacker in, fatigued midfielder out",
    "Forced substitution due to minor ankle knock",
    "Fresh legs introduced to bolster the defensive line"
  ],
  VAR_CHECK: [
    "VAR Check: Reviewing potential penalty inside the box... Decision: NO PENALTY",
    "VAR Check: Checking potential handball in build-up... Decision: PLAY ON",
    "VAR Check: Reviewing tight offside call... Decision: GOAL STANDS"
  ],
  INJURY_TIMEOUT: [
    "Physio team rushed onto the pitch treating player's hamstring",
    "Brief stoppage for a head collision check"
  ]
};

const generatePredeterminedScript = (homeTeam, awayTeam) => {
  // 1. DOKEZO KUU: Predetermined Target Scores
  const homeScore = getRandomInt(0, 3);
  const awayScore = getRandomInt(0, 3);
  
  const htHome = getRandomInt(0, homeScore);
  const htAway = getRandomInt(0, awayScore);

  const shHome = homeScore - htHome;
  const shAway = awayScore - htAway;

  // Extra time minutes allocation
  const htExtraTimeMins = getRandomInt(1, 3); // +1 hadi +3 mins
  const ftExtraTimeMins = getRandomInt(3, 6); // +3 hadi +6 mins

  const timeline = [];
  const usedMinutes = new Set();

  const getUniqueMinute = (start, end) => {
    let min;
    let attempts = 0;
    do {
      min = getRandomInt(start, end);
      attempts++;
    } while (usedMinutes.has(min) && attempts < 100);
    usedMinutes.add(min);
    return min;
  };

  const formatMinuteString = (baseMin, extraMin = 0) => {
    return extraMin > 0 ? `${baseMin}+${extraMin}` : `${baseMin}`;
  };

  // A) Distribution ya Magoli ya HT (Aina ya Home / Away imehifadhiwa strictly kwa htHome na htAway)
  let htGoals = [];
  for (let i = 0; i < htHome; i++) htGoals.push("home");
  for (let i = 0; i < htAway; i++) htGoals.push("away");

  htGoals.forEach((team) => {
    const isExtraTimeGoal = Math.random() < 0.15;
    let minute, extraMin = 0, numericOrder;

    if (isExtraTimeGoal) {
      minute = 45;
      extraMin = getRandomInt(1, htExtraTimeMins);
      numericOrder = 45 + (extraMin * 0.1);
    } else {
      minute = getUniqueMinute(3, 44);
      numericOrder = minute;
    }

    timeline.push({
      minute: formatMinuteString(minute, extraMin),
      numeric_order: numericOrder,
      type: "GOAL",
      team,
      description: team === "home" ? `GOAL! ${homeTeam} scores!` : `GOAL! ${awayTeam} scores!`
    });
  });

  // B) Distribution ya Magoli ya Second Half (shHome & shAway)
  let shGoals = [];
  for (let i = 0; i < shHome; i++) shGoals.push("home");
  for (let i = 0; i < shAway; i++) shGoals.push("away");

  shGoals.forEach((team) => {
    const isExtraTimeGoal = Math.random() < 0.25;
    let minute, extraMin = 0, numericOrder;

    if (isExtraTimeGoal) {
      minute = 90;
      extraMin = getRandomInt(1, ftExtraTimeMins);
      numericOrder = 90 + (extraMin * 0.1);
    } else {
      minute = getUniqueMinute(46, 89);
      numericOrder = minute;
    }

    timeline.push({
      minute: formatMinuteString(minute, extraMin),
      numeric_order: numericOrder,
      type: "GOAL",
      team,
      description: team === "home" ? `GOAL! ${homeTeam} scores!` : `GOAL! ${awayTeam} scores!`
    });
  });

  // C) Continuous Pace Generation (Filler Events zisizo Magoli)
  const fillerTypes = ["FOUL", "SHOT_OFF_TARGET", "SHOT_ON_TARGET", "CORNER", "YELLOW_CARD", "SUBSTITUTION", "VAR_CHECK"];

  // First Half Flow
  for (let m = 2; m <= 44; m += getRandomInt(3, 6)) {
    if (!usedMinutes.has(m)) {
      usedMinutes.add(m);
      const type = getRandomElement(fillerTypes);
      const team = Math.random() > 0.5 ? "home" : "away";
      const eventObj = {
        minute: `${m}`,
        numeric_order: m,
        type,
        team,
        description: getRandomElement(EVENT_TEMPLATES[type])
      };
      if (type === "YELLOW_CARD") eventObj.player = `Player #${getRandomInt(2, 11)}`;
      timeline.push(eventObj);
    }
  }

  // Second Half Flow
  for (let m = 47; m <= 89; m += getRandomInt(3, 6)) {
    if (!usedMinutes.has(m)) {
      usedMinutes.add(m);
      const type = getRandomElement(fillerTypes);
      const team = Math.random() > 0.5 ? "home" : "away";
      const eventObj = {
        minute: `${m}`,
        numeric_order: m,
        type,
        team,
        description: getRandomElement(EVENT_TEMPLATES[type])
      };
      if (type === "YELLOW_CARD") eventObj.player = `Player #${getRandomInt(2, 11)}`;
      timeline.push(eventObj);
    }
  }

  // D) Matukio ya Extra Time Drama
  if (htExtraTimeMins >= 2 && Math.random() > 0.4) {
    timeline.push({
      minute: `45+1`,
      numeric_order: 45.1,
      type: "FOUL",
      team: Math.random() > 0.5 ? "home" : "away",
      description: "Late foul in the final seconds of first half stoppage time"
    });
  }

  if (ftExtraTimeMins >= 3 && Math.random() > 0.3) {
    const randomLateType = getRandomElement(["YELLOW_CARD", "SHOT_ON_TARGET", "CORNER", "VAR_CHECK"]);
    const team = Math.random() > 0.5 ? "home" : "away";
    const lateObj = {
      minute: `90+${getRandomInt(2, ftExtraTimeMins - 1)}`,
      numeric_order: 90.2,
      type: randomLateType,
      team,
      description: getRandomElement(EVENT_TEMPLATES[randomLateType])
    };
    if (randomLateType === "YELLOW_CARD") lateObj.player = `Player #${getRandomInt(2, 11)}`;
    timeline.push(lateObj);
  }

  // E) Structural Boundaries
  timeline.push(
    { minute: "45", numeric_order: 45.0, type: "ADDED_TIME", description: `+${htExtraTimeMins} minutes of extra time added` },
    { minute: `45+${htExtraTimeMins}`, numeric_order: 45.9, type: "HALF_TIME", description: "Referee blows whistle for Half-Time" },
    { minute: "90", numeric_order: 90.0, type: "ADDED_TIME", description: `+${ftExtraTimeMins} minutes of extra time added` },
    { minute: `90+${ftExtraTimeMins}`, numeric_order: 90.9, type: "FULL_TIME", description: `Full-Time whistle! Final score: ${homeScore}-${awayScore}` }
  );

  // F) Order Sorting & Score Synchronization (Mzingo wa Usalama wa Live Score)
  timeline.sort((a, b) => a.numeric_order - b.numeric_order);

  let runningHome = 0;
  let runningAway = 0;
  const goalEvents = [];

  const stats = {
    corners: { home: 0, away: 0 },
    yellow_cards: { home: 0, away: 0 },
    red_cards: { home: 0, away: 0 },
    shots_on_target: { home: 0, away: 0 }
  };

  const cleanTimeline = timeline.map(event => {
    // Ikiwa ni goli, ongeza kwenye running score
    if (event.type === "GOAL") {
      if (event.team === "home") runningHome++;
      if (event.team === "away") runningAway++;
      goalEvents.push(event);
      stats.shots_on_target[event.team]++;
    }

    // Weka current score snapshot kwenye KILA TUKIO ili UI isome bila shida
    event.current_score = { home: runningHome, away: runningAway };

    if (event.type === "CORNER" && event.team) stats.corners[event.team]++;
    if (event.type === "YELLOW_CARD" && event.team) stats.yellow_cards[event.team]++;
    if (event.type === "RED_CARD" && event.team) stats.red_cards[event.team]++;
    if (event.type === "SHOT_ON_TARGET" && event.team) stats.shots_on_target[event.team]++;

    const { numeric_order, ...cleanEvent } = event;
    return cleanEvent;
  });

  // G) Verification for Goal Teams
  let firstGoalBy = "none";
  let lastGoalBy = "none";

  if (goalEvents.length > 0) {
    firstGoalBy = goalEvents[0].team;
    lastGoalBy = goalEvents[goalEvents.length - 1].team;
  }

  return {
    final_ft: { homeScore, awayScore },
    final_ht: { homeScore: htHome, awayScore: htAway },
    second_half: { homeScore: shHome, awayScore: shAway },
    extra_time_mins: { ht: htExtraTimeMins, ft: ftExtraTimeMins },
    first_goal_by: firstGoalBy,
    last_goal_by: lastGoalBy,
    stats,
    events_timeline: cleanTimeline
  };
};

// 2. Normalize base 1X2 odds - Mahitaji yanaweza kuja kama {1,X,2} AU {home,draw,away}
const normalizeBaseOdds = (base1X2 = {}) => {
  const b = base1X2 || {};
  const toNum = (v) => {
    const n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : null;
  };
  return {
    "1": toNum(b["1"] ?? b.home ?? b.Home),
    "X": toNum(b["X"] ?? b.draw ?? b.Draw),
    "2": toNum(b["2"] ?? b.away ?? b.Away)
  };
};

// Rebalance yenye ukingo mdogo wa bookmaker (~5-8%) ili odds zikae halali
const adjustGlobal = (r1, rX, r2) => {
  const inv = 1 / r1 + 1 / rX + 1 / r2;
  const targetSum = 1.05 + Math.random() * 0.03;
  const k = inv / targetSum;
  return {
    "1": roundOdds(r1 * k),
    "X": roundOdds(rX * k),
    "2": roundOdds(r2 * k)
  };
};

// 3. Zalisha Base Odds tofauti kwa kila mechi
//    - Sides zisizotolewa (missing) hujazwa na nasibu ndani ya mipaka halisi
//    - Sides zilizotolewa zina jitter nyepesi ili kila mechi iwe na odds zake
const generateRandomBaseOdds = (base1X2 = {}) => {
  const norm = normalizeBaseOdds(base1X2);
  const randomIn = (min, max) => roundOdds(min + Math.random() * (max - min));

  // Ranges za kawaida za 1X2 (mtandaoni)
  const o1 = norm["1"] || randomIn(1.50, 4.00);
  const oX = norm["X"] || randomIn(2.90, 4.80);
  const o2 = norm["2"] || randomIn(1.50, 4.00);

  // Jitter (0.86 - 1.16) ili hata mechi zilizoingizwa na odds sawa ziwe tofauti
  const jitter = (v) => roundOdds(v * (0.86 + Math.random() * 0.30));

  const j1 = jitter(o1);
  const jX = jitter(oX);
  const j2 = jitter(o2);

  // Rebalance ili jumla ya uwezekano isiwe mbaya sana (bookmaker margin ~5-10%)
  return adjustGlobal(j1, jX, j2);
};

// 4. Full markets zitokazo kwenye base 1X2 ya mechi hiyo (kila mechi ina zake)
const generateMatchOdds = (base1X2 = {}) => {
  return generateFullMarkets(generateRandomBaseOdds(base1X2));
};

// 2. Function inayozalisha Complete Markets kutoka Base 1X2 Odds
const generateFullMarkets = (base1X2) => {
  const o1 = parseFloat(base1X2["1"] || 2.50);
  const oX = parseFloat(base1X2["X"] || 3.20);
  const o2 = parseFloat(base1X2["2"] || 2.80);

  return {
    "1X2": { "1": o1, "X": oX, "2": o2 },
    "Double_Chance": {
      "1X": roundOdds(1 / ((1/o1) + (1/oX))),
      "X2": roundOdds(1 / ((1/oX) + (1/o2))),
      "12": roundOdds(1 / ((1/o1) + (1/o2)))
    },
    "BTTS": {
      "Yes": roundOdds(o1 > 2.0 && o2 > 2.0 ? 1.85 : 1.95),
      "No": roundOdds(o1 > 2.0 && o2 > 2.0 ? 1.90 : 1.80)
    },
    "Over_Under": {
      "OVER_0.5": 1.08, "UNDER_0.5": 6.50,
      "OVER_1.5": 1.45, "UNDER_1.5": 2.50,
      "OVER_2.5": roundOdds((o1 + o2) / 1.8), "UNDER_2.5": roundOdds((o1 + o2) / 2.2),
      "OVER_3.5": 3.80, "UNDER_3.5": 1.22,
      "OVER_4.5": 8.50, "UNDER_4.5": 1.04
    },
    "Correct_Score": {
      "0-0": roundOdds(oX * 2.8), "1-0": roundOdds(o1 * 2.2), "0-1": roundOdds(o2 * 2.2),
      "1-1": roundOdds(oX * 1.8), "2-0": roundOdds(o1 * 3.5), "0-2": roundOdds(o2 * 3.5),
      "2-1": roundOdds(o1 * 3.0), "1-2": roundOdds(o2 * 3.0), "2-2": roundOdds(oX * 3.2),
      "3-0": roundOdds(o1 * 6.0), "0-3": roundOdds(o2 * 6.0), "3-1": roundOdds(o1 * 5.0),
      "1-3": roundOdds(o2 * 5.0), "3-2": roundOdds(o1 * 7.5), "2-3": roundOdds(o2 * 7.5),
      "Other": 25.00
    },
    "Handicap": {
      "Home_-1": roundOdds(o1 * 2.1), "Home_-2": roundOdds(o1 * 3.8),
      "Away_+1": roundOdds(o2 * 0.8), "Away_+2": roundOdds(o2 * 0.5)
    },
    "HT_FT": {
      "Home_Home": roundOdds(o1 * 1.8), "Home_Draw": 14.00,
      "Home_Away": 32.00, "Draw_Home": roundOdds(o1 * 2.5),
      "Draw_Draw": roundOdds(oX * 1.6), "Draw_Away": roundOdds(o2 * 2.5),
      "Away_Home": 35.00, "Away_Draw": 15.00,
      "Away_Away": roundOdds(o2 * 1.8)
    },
    "BTTS_Win": {
      "Home_Yes": roundOdds(o1 * 2.3), "Home_No": roundOdds(o1 * 1.7),
      "Away_Yes": roundOdds(o2 * 2.3), "Away_No": roundOdds(o2 * 1.7),
      "Draw_Yes": roundOdds(oX * 1.9)
    },
    "Odd_Even": { "Odd": 1.90, "Even": 1.85 },
    "Total_Goals": {
      "0": 8.50, "1": 4.20, "2": 3.40,
      "3": 4.00, "4": 6.50, "5+": 12.00
    },
    "Both_Halves": {
      "OVER_0.5_Both": 1.80, "OVER_1.5_Both": 4.50,
      "UNDER_0.5_Both": 8.00
    },
    "First_Last_Goal": {
      "First_Goal_Home": roundOdds(o1 * 0.8), "First_Goal_Away": roundOdds(o2 * 0.8),
      "First_Goal_No": 10.00, "Last_Goal_Home": roundOdds(o1 * 0.85),
      "Last_Goal_Away": roundOdds(o2 * 0.85), "Last_Goal_No": 10.00
    },
    "Highest_Scoring_Half": {
      "First_Half": 3.10, "Second_Half": 2.05, "Equal": 3.40
    },
    "Clean_Sheet": {
      "Home": roundOdds(o2 * 1.3), "Away": roundOdds(o1 * 1.3),
      "Both": 7.00, "Neither": 1.80
    }
  };
};

module.exports = {
  generatePredeterminedScript,
  generateFullMarkets,
  generateRandomBaseOdds,
  generateMatchOdds,
  normalizeBaseOdds
};