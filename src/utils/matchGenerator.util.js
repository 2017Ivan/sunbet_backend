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
  const htExtraTimeMins = getRandomInt(1, 3); // +1 hadi +3 mins (first half stoppage)
  const ftExtraTimeMins = getRandomInt(5, 9); // +5 hadi +9 mins (second half stoppage as requested)
  const halfTimeBreakMins = 15; // 15 minutes halftime break

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

  // Second Half Flow - events are at 46-89 in real terms, but we need to account for halftime break
  // Wait - the events in second half are "46 onwards" in football, but in our timeline structure
  // we need to be clear: in the timeline minutes, second half events start at 46 and go to 90+
  // The halftime break is the gap between 45+ht and 46 - so in real time progression,
  // after HALF_TIME (at 45+ht) we wait 15 mins, then start second half (46)
  const halftimeBreakMins = 15;
  for (let m = 46; m <= 89; m += getRandomInt(3, 6)) {
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
    halftime_break_mins: halfTimeBreakMins,
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

const MAX_GOALS = 12;
const MODEL_MARGIN = 1.05;
const MAX_GENERATED_ODDS = 15;
const CORRECT_SCORE_ODDS_MIN = 2;
const CORRECT_SCORE_ODDS_MAX = 14.99;

const poissonDistribution = (lambda) => {
  const probabilities = [Math.exp(-lambda)];
  for (let goals = 1; goals <= MAX_GOALS; goals += 1) {
    probabilities.push((probabilities[goals - 1] * lambda) / goals);
  }
  return probabilities;
};

const getScoreMatrix = (homeLambda, awayLambda) => {
  const homeGoals = poissonDistribution(homeLambda);
  const awayGoals = poissonDistribution(awayLambda);
  const scores = [];
  let totalProbability = 0;

  for (let home = 0; home <= MAX_GOALS; home += 1) {
    for (let away = 0; away <= MAX_GOALS; away += 1) {
      const probability = homeGoals[home] * awayGoals[away];
      scores.push({ home, away, probability });
      totalProbability += probability;
    }
  }

  return scores.map((score) => ({
    ...score,
    probability: score.probability / totalProbability
  }));
};

const marketProbabilities = (scores) => {
  const probabilities = {
    home: 0,
    draw: 0,
    away: 0,
    bttsYes: 0,
    homeCleanSheet: 0,
    awayCleanSheet: 0,
    odd: 0,
    exactGoals: new Map(),
    correctScore: new Map(),
    resultAndBtts: new Map(),
    over: new Map()
  };

  for (const score of scores) {
    const { home, away, probability } = score;
    const total = home + away;
    if (home > away) probabilities.home += probability;
    else if (home === away) probabilities.draw += probability;
    else probabilities.away += probability;
    if (home > 0 && away > 0) probabilities.bttsYes += probability;
    if (away === 0) probabilities.homeCleanSheet += probability;
    if (home === 0) probabilities.awayCleanSheet += probability;
    if (total % 2 !== 0) probabilities.odd += probability;

    probabilities.exactGoals.set(total, (probabilities.exactGoals.get(total) || 0) + probability);
    probabilities.correctScore.set(`${home}-${away}`, probability);

    const result = home > away ? 'Home' : away > home ? 'Away' : 'Draw';
    const btts = home > 0 && away > 0 ? 'Yes' : 'No';
    const comboKey = `${result}_${btts}`;
    probabilities.resultAndBtts.set(
      comboKey,
      (probabilities.resultAndBtts.get(comboKey) || 0) + probability
    );

    for (let halfLine = 0.5; halfLine <= 5.5; halfLine += 1) {
      if (total > halfLine) {
        probabilities.over.set(halfLine, (probabilities.over.get(halfLine) || 0) + probability);
      }
    }
  }

  return probabilities;
};

const normalizeImpliedProbabilities = (odds) => {
  const normalized = normalizeBaseOdds(odds);
  const values = [normalized['1'], normalized.X, normalized['2']];
  if (values.some((value) => !value)) return null;

  const total = values.reduce((sum, value) => sum + (1 / value), 0);
  return {
    home: (1 / normalized['1']) / total,
    draw: (1 / normalized.X) / total,
    away: (1 / normalized['2']) / total
  };
};

const getGoalLineReference = (referenceMarkets = {}) => {
  for (const marketKey of ['Over_Under', 'Goal_Line_Fixed']) {
    const selections = referenceMarkets[marketKey];
    const over = parseFloat(selections?.['OVER_2.5']);
    const under = parseFloat(selections?.['UNDER_2.5']);
    if (over > 1 && under > 1) {
      const overProbability = (1 / over) / ((1 / over) + (1 / under));
      return { overProbability };
    }
  }
  return null;
};

const fitExpectedGoalsParameters = (target, goalLineReference) => {
  let best = { loss: Infinity, homeLambda: 1.3, awayLambda: 1.3 };
  const candidates = [];

  for (let homeLambda = 0.2; homeLambda <= 4.4; homeLambda += 0.1) {
    const distribution = poissonDistribution(homeLambda);
    const total = distribution.reduce((sum, probability) => sum + probability, 0);
    const normalized = distribution.map((probability) => probability / total);
    const cumulative = [];
    let cumulativeProbability = 0;
    for (let goals = 0; goals <= MAX_GOALS; goals += 1) {
      cumulativeProbability += normalized[goals];
      cumulative[goals] = cumulativeProbability;
    }
    candidates.push({ lambda: homeLambda, distribution: normalized, cumulative });
  }

  for (const home of candidates) {
    for (const away of candidates) {
      let homeProbability = 0;
      let drawProbability = 0;
      for (let goals = 0; goals <= MAX_GOALS; goals += 1) {
        drawProbability += home.distribution[goals] * away.distribution[goals];
        if (goals > 0) {
          homeProbability += home.distribution[goals] * away.cumulative[goals - 1];
        }
      }
      const awayProbability = 1 - homeProbability - drawProbability;
      let loss = (homeProbability - target.home) ** 2
        + (drawProbability - target.draw) ** 2
        + (awayProbability - target.away) ** 2;
      if (goalLineReference) {
        const underProbability = home.distribution[0] * (
          away.distribution[0] + away.distribution[1] + away.distribution[2]
        ) + home.distribution[1] * (
          away.distribution[0] + away.distribution[1]
        ) + home.distribution[2] * away.distribution[0];
        const modelOver = 1 - underProbability;
        loss += 1.5 * (modelOver - goalLineReference.overProbability) ** 2;
      }
      if (loss < best.loss) {
        best = { loss, homeLambda: home.lambda, awayLambda: away.lambda };
      }
    }
  }

  return best;
};

const fitExpectedGoals = (target, goalLineReference) => {
  const { homeLambda, awayLambda } = fitExpectedGoalsParameters(target, goalLineReference);
  return getScoreMatrix(homeLambda, awayLambda);
};

const seededRandom = (seed) => {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) / 0x100000000;
};

const getCorrectScoreOdds = (oddsSeed, selection) => {
  const randomValue = seededRandom(`${oddsSeed}:Correct_Score:${selection}`);
  const odds = CORRECT_SCORE_ODDS_MIN
    + randomValue * (CORRECT_SCORE_ODDS_MAX - CORRECT_SCORE_ODDS_MIN);
  return Number(odds.toFixed(2));
};

const oddsFromProbability = (probability, seed) => {
  const odds = 1 / (probability * MODEL_MARGIN);
  if (!Number.isFinite(odds) || odds > MAX_GENERATED_ODDS) {
    return Number((4 + seededRandom(seed) * (MAX_GENERATED_ODDS - 4)).toFixed(2));
  }
  return roundOdds(odds);
};

const generateMarketsFromScores = (
  base1X2,
  referenceMarkets,
  scores,
  { oddsSeed = '' } = {}
) => {
  const probabilities = marketProbabilities(scores);
  const resultProbabilities = {
    home: probabilities.home,
    draw: probabilities.draw,
    away: probabilities.away
  };
  const price = (probability, selection) => oddsFromProbability(
    probability,
    `${oddsSeed}:${selection}`
  );
  const result = {
    '1X2': {
      '1': base1X2['1'] ?? base1X2.home ?? price(resultProbabilities.home, '1X2:1'),
      X: base1X2.X ?? base1X2.draw ?? price(resultProbabilities.draw, '1X2:X'),
      '2': base1X2['2'] ?? base1X2.away ?? price(resultProbabilities.away, '1X2:2')
    },
    Double_Chance: {
      '1X': price(resultProbabilities.home + resultProbabilities.draw, 'Double_Chance:1X'),
      X2: price(resultProbabilities.draw + resultProbabilities.away, 'Double_Chance:X2'),
      '12': price(resultProbabilities.home + resultProbabilities.away, 'Double_Chance:12')
    },
    Draw_No_Bet: {
      '1': price(resultProbabilities.home / (resultProbabilities.home + resultProbabilities.away), 'Draw_No_Bet:1'),
      '2': price(resultProbabilities.away / (resultProbabilities.home + resultProbabilities.away), 'Draw_No_Bet:2')
    },
    BTTS: {
      Yes: price(probabilities.bttsYes, 'BTTS:Yes'),
      No: price(1 - probabilities.bttsYes, 'BTTS:No')
    },
    Over_Under: {},
    Correct_Score: {},
    Total_Goals: {},
    BTTS_Win: {},
    Odd_Even: {
      Odd: price(probabilities.odd, 'Odd_Even:Odd'),
      Even: price(1 - probabilities.odd, 'Odd_Even:Even')
    },
    Clean_Sheet: {
      Home_Yes: price(probabilities.homeCleanSheet, 'Clean_Sheet:Home_Yes'),
      Home_No: price(1 - probabilities.homeCleanSheet, 'Clean_Sheet:Home_No'),
      Away_Yes: price(probabilities.awayCleanSheet, 'Clean_Sheet:Away_Yes'),
      Away_No: price(1 - probabilities.awayCleanSheet, 'Clean_Sheet:Away_No')
    }
  };

  for (let line = 0.5; line <= 5.5; line += 1) {
    const overProbability = probabilities.over.get(line) || 0;
    result.Over_Under[`OVER_${line}`] = price(overProbability, `Over_Under:OVER_${line}`);
    result.Over_Under[`UNDER_${line}`] = price(1 - overProbability, `Over_Under:UNDER_${line}`);
  }

  for (let home = 0; home <= 4; home += 1) {
    for (let away = 0; away <= 4; away += 1) {
      const scoreKey = `${home}-${away}`;
      result.Correct_Score[scoreKey] = getCorrectScoreOdds(oddsSeed, scoreKey);
    }
  }
  result.Correct_Score.Other = getCorrectScoreOdds(oddsSeed, 'Other');

  for (let goals = 0; goals <= 5; goals += 1) {
    result.Total_Goals[String(goals)] = price(
      probabilities.exactGoals.get(goals) || 0,
      `Total_Goals:${goals}`
    );
  }
  result.Total_Goals['6+'] = price(
    [...probabilities.exactGoals.entries()]
      .filter(([goals]) => goals >= 6)
      .reduce((sum, [, probability]) => sum + probability, 0)
    ,
    'Total_Goals:6+'
  );

  for (const resultKey of ['Home', 'Draw', 'Away']) {
    for (const bttsKey of ['Yes', 'No']) {
      const key = `${resultKey}_${bttsKey}`;
      result.BTTS_Win[key] = price(
        probabilities.resultAndBtts.get(key) || 0,
        `BTTS_Win:${key}`
      );
    }
  }

  for (const [marketKey, selections] of Object.entries(referenceMarkets)) {
    result[marketKey] = {
      ...(result[marketKey] || {}),
      ...(selections && typeof selections === 'object' ? selections : {})
    };
  }
  return result;
};

const generateFullMarkets = (base1X2 = {}, referenceMarkets = {}, { oddsSeed } = {}) => {
  const target = normalizeImpliedProbabilities(base1X2);
  if (!target) return { ...referenceMarkets };

  const scores = fitExpectedGoals(target, getGoalLineReference(referenceMarkets));
  return generateMarketsFromScores(base1X2, referenceMarkets, scores, {
    oddsSeed: oddsSeed || Math.random().toString(36).slice(2)
  });
};

const generateMatchOdds = (base1X2 = {}, referenceMarkets = {}, options = {}) => (
  generateFullMarkets(base1X2, referenceMarkets, options)
);

module.exports = {
  generatePredeterminedScript,
  generateFullMarkets,
  generateRandomBaseOdds,
  generateMatchOdds,
  getCorrectScoreOdds,
  normalizeBaseOdds
};