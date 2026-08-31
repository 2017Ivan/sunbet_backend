// Helper za Random Utilities
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const roundOdds = (val) => parseFloat(Math.max(1.01, val).toFixed(2));
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Bank ya Maelezo ya Matukio ya Mechi kwa Ajili ya Varietiy
const EVENT_TEMPLATES = {
  FOUL: [
    "Aggressive tackle in midfield",
    "Late challenge on the wing",
    "Holding shirt during counter-attack",
    "Pushing during aerial duel"
  ],
  SHOT_OFF_TARGET: [
    "Long range effort flies high over the bar",
    "Header wide of the left post",
    "Volley dragged wide from outside the box",
    "Free kick curled well over the wall"
  ],
  SHOT_ON_TARGET: [
    "Stunning reflex save by goalkeeper!",
    "Header saved right on the goal line",
    "Low driving shot caught comfortably by keeper",
    "Powerful strike tipped over the crossbar"
  ],
  CORNER: [
    "Inswinging corner punched away by keeper",
    "Corner cleared at front post by defender",
    "Short corner routine intercepted",
    "Outswinging corner met by high header"
  ],
  YELLOW_CARD: [
    "Tactical foul to stop counter-attack",
    "Late sliding challenge",
    "Dissent towards the referee",
    "Time wasting on throw-in"
  ],
  SUBSTITUTION: [
    "Tactical change: Attacker in, defender out",
    "Forced substitution due to minor injury",
    "Fresh legs introduced in midfield"
  ],
  VAR_CHECK: [
    "Reviewing potential penalty - Decision: Play on",
    "Check for potential handball in the box - No penalty",
    "Offside check completed - Goal decision stands"
  ],
  INJURY_TIMEOUT: [
    "Physio on pitch treating player",
    "Brief stoppage for head collision check"
  ]
};

// 1. Function inayozalisha Predetermined Script na Timeline ya Kipekee
const generatePredeterminedScript = (homeTeam, awayTeam) => {
  const homeScore = getRandomInt(0, 3);
  const awayScore = getRandomInt(0, 3);
  
  const htHome = getRandomInt(0, homeScore);
  const htAway = getRandomInt(0, awayScore);

  const shHome = homeScore - htHome;
  const shAway = awayScore - htAway;

  let firstGoalBy = "none";
  let lastGoalBy = "none";

  if (homeScore > 0 || awayScore > 0) {
    if (homeScore > 0 && awayScore === 0) {
      firstGoalBy = "home"; lastGoalBy = "home";
    } else if (awayScore > 0 && homeScore === 0) {
      firstGoalBy = "away"; lastGoalBy = "away";
    } else {
      firstGoalBy = Math.random() > 0.5 ? "home" : "away";
      lastGoalBy = Math.random() > 0.5 ? "home" : "away";
    }
  }

  const timeline = [];

  // A) Zalisha Random Filler Events (Matukio ya nasibu 10-16 wakati wa mchezo)
  const numberOfFillerEvents = getRandomInt(10, 16);
  const usedMinutes = new Set([45, 48, 90, 95]); // Tenga dakika za HT & FT

  const eventTypes = ["FOUL", "SHOT_OFF_TARGET", "SHOT_ON_TARGET", "CORNER", "YELLOW_CARD", "SUBSTITUTION", "VAR_CHECK", "INJURY_TIMEOUT"];

  for (let i = 0; i < numberOfFillerEvents; i++) {
    let minute;
    do {
      minute = getRandomInt(1, 89);
    } while (usedMinutes.has(minute));
    
    usedMinutes.add(minute);

    const type = getRandomElement(eventTypes);
    const team = Math.random() > 0.5 ? "home" : "away";
    const description = getRandomElement(EVENT_TEMPLATES[type]);

    const eventObj = { minute, type, team, description };
    if (type === "YELLOW_CARD") {
      eventObj.player = team === "home" ? `Player #${getRandomInt(2, 11)}` : `Player #${getRandomInt(2, 11)}`;
    }
    
    timeline.push(eventObj);
  }

  // B) Pangilia Magoli ya Half-Time (1-44 Mins)
  let goalsToDistribute = [];
  for (let i = 0; i < htHome; i++) goalsToDistribute.push("home");
  for (let i = 0; i < htAway; i++) goalsToDistribute.push("away");
  
  goalsToDistribute.forEach((team) => {
    let minute;
    do {
      minute = getRandomInt(3, 42);
    } while (usedMinutes.has(minute));
    
    usedMinutes.add(minute);
    timeline.push({
      minute,
      type: "GOAL",
      team,
      description: team === "home" ? `Goal for ${homeTeam}!` : `Goal for ${awayTeam}!`
    });
  });

  // C) Pangilia Magoli ya Second-Half (46-88 Mins)
  goalsToDistribute = [];
  for (let i = 0; i < shHome; i++) goalsToDistribute.push("home");
  for (let i = 0; i < shAway; i++) goalsToDistribute.push("away");

  goalsToDistribute.forEach((team) => {
    let minute;
    do {
      minute = getRandomInt(47, 88);
    } while (usedMinutes.has(minute));

    usedMinutes.add(minute);
    timeline.push({
      minute,
      type: "GOAL",
      team,
      description: team === "home" ? `Goal for ${homeTeam}!` : `Goal for ${awayTeam}!`
    });
  });

  // D) Weka Half Time na Full Time Thresholds
  const htAddedMinutes = getRandomInt(1, 3);
  const ftAddedMinutes = getRandomInt(3, 6);

  timeline.push(
    { minute: 45, type: "ADDED_TIME", description: `${htAddedMinutes} minutes of extra time added` },
    { minute: 45 + htAddedMinutes, type: "HALF_TIME", current_score: { home: htHome, away: htAway }, description: "Referee blows whistle for Half-Time" },
    { minute: 90, type: "ADDED_TIME", description: `${ftAddedMinutes} minutes added on` },
    { minute: 90 + ftAddedMinutes, type: "FULL_TIME", current_score: { home: homeScore, away: awayScore }, description: `Full-Time whistle! Final score: ${homeScore}-${awayScore}` }
  );

  // E) Panga Matukio kulingana na Dakika & Kurekebisha Current Score ya Kila Goli
  timeline.sort((a, b) => a.minute - b.minute);

  let runningHome = 0;
  let runningAway = 0;

  timeline.forEach((event) => {
    if (event.type === "GOAL") {
      if (event.team === "home") runningHome++;
      if (event.team === "away") runningAway++;
      event.current_score = { home: runningHome, away: runningAway };
    }
  });

  return {
    final_ft: { homeScore, awayScore },
    final_ht: { homeScore: htHome, awayScore: htAway },
    second_half: { homeScore: shHome, awayScore: shAway },
    first_goal_by: firstGoalBy,
    last_goal_by: lastGoalBy,
    stats: {
      corners: { home: getRandomInt(3, 9), away: getRandomInt(2, 7) },
      yellow_cards: { home: getRandomInt(1, 5), away: getRandomInt(1, 5) },
      red_cards: { home: 0, away: Math.random() > 0.85 ? 1 : 0 },
      shots_on_target: { home: getRandomInt(3, 11), away: getRandomInt(2, 9) }
    },
    events_timeline: timeline
  };
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
  generateFullMarkets
};