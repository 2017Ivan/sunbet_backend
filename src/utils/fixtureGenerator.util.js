// fixtureGenerator.util.js
// Random Generator ya Fixtures - Majina ya timu ni YA KUBUNI (sio ya kweli) na
// yanatoka nje ya Afrika; Ligi zinaweza kutumia majina halisi ya dunia.

// ==========================================================================
// A) DUKA LA LIGI (Mahususi: Ligi HALISI za nje ya Afrika)
// ==========================================================================
const LEAGUES_BANK = [
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Eredivisie",
  "Primeira Liga",
  "Scottish Premiership",
  "Süper Lig",
  "MLS",
  "Brasileirão Série A",
  "Liga MX",
  "Argentine Primera División",
  "Championship",
  "Champions League"
];

// ==========================================================================
// B) DUKA LA MAJI MAJI YA TIMU (Miji ya Ulaya / Amerika Kusini - sio Afrika)
//    Majina yachaguliwa kukwepa majina ya moja kwa moja ya vilabu maarufu.
// ==========================================================================
const CITY_POOL = [
  "Vienna", "Graz", "Salzburg", "Innsbruck", "Klagenfurt", "Linz",
  "Zurich", "Bern", "Basel", "Geneva", "Lausanne", "Lugano",
  "Oslo", "Bergen", "Trondheim", "Stavanger",
  "Copenhagen", "Aarhus", "Odense", "Aalborg",
  "Utrecht", "Groningen", "Enschede", "Breda",
  "Bruges", "Ghent", "Mechelen", "Charleroi",
  "Bratislava", "Kosice", "Presov", "Zilina",
  "Zagreb", "Split", "Rijeka", "Ljubljana", "Maribor",
  "Krakow", "Wroclaw", "Poznan", "Gdansk", "Lodz", "Bydgoszcz",
  "Plzen", "Ostrava", "Liberec", "Brno", "Hradec Kralove",
  "Tallinn", "Vilnius", "Kaunas", "Riga",
  "Helsinki", "Tampere", "Turku", "Oulu",
  "Stockholm", "Gothenburg", "Malmo", "Uppsala",
  "Reykjavik", "Dublin", "Cork", "Galway",
  "Santiago", "Valparaiso", "Montevideo", "Asuncion", "Quito", "Medellin"
];

const CLUB_SUFFIXES = [
  "City", "United", "Rovers", "Athletic", "Wanderers",
  "Sporting", "Villa", "Town", "Borough", "Harbour",
  "Stars", "Academy", "1899", "1903"
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ==========================================================================
// C) GENERATE TEAM NAMES (kila jina LIpekee ndani ya batch)
//    Mfumo: "City + Suffix" e.g. "Krakow United", "Montevideo City"
// ==========================================================================
const generateTeamNames = (count) => {
  const names = new Set();
  const attemptsPerName = 200;

  for (let i = 0; i < count; i++) {
    let name = null;

    for (let attempt = 0; attempt < attemptsPerName; attempt++) {
      const city = CITY_POOL[Math.floor(Math.random() * CITY_POOL.length)];
      const suffix = CLUB_SUFFIXES[Math.floor(Math.random() * CLUB_SUFFIXES.length)];

      // Epic-sounding: wakati mwingine "Pool Swallows", wakati mwingine "Naga City"
      const candidate = Math.random() > 0.85
        ? `FC ${city}`
        : `${city} ${suffix}`;

      if (!names.has(candidate)) {
        name = candidate;
        break;
      }
    }

    if (!name) {
      name = `FC Aurora ${i + 1}`;
    }

    names.add(name);
  }

  return [...names];
};

// ==========================================================================
// D) PAIR TEAMS INTO FIXTURES (hakuna timu inayorudiwa mara mbili kwenye batch)
// ==========================================================================
const generateFixturesTeams = (count) => {
  const teamCount = count * 2;
  let teamNames = generateTeamNames(teamCount);

  // Walinzi: kama hatujapata vitoshee vya kutosha, ongeza vya ziada
  while (teamNames.length < teamCount) {
    teamNames.push(...generateTeamNames(teamCount));
    teamNames = [...new Set(teamNames)].slice(0, teamCount);
  }

  teamNames = shuffle(teamNames).slice(0, teamCount);

  const fixtures = [];
  for (let i = 0; i < count; i++) {
    const home = teamNames[i * 2];
    const away = teamNames[i * 2 + 1];
    if (home && away) {
      fixtures.push({ home_team: home, away_team: away });
    }
  }
  return fixtures;
};

// ==========================================================================
// E) SCHEDULE (usambaze kwenye siku zijazo)
// ==========================================================================
const pad = (n) => String(n).padStart(2, '0');

const generateFixtureSchedule = (from = 1, to = 7) => {
  const now = new Date();
  const dayOffset = from + Math.floor(Math.random() * (to - from + 1));
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);

  // Saa za mchezo: 12:00 - 22:00
  const hour = 12 + Math.floor(Math.random() * 11);
  const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];

  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timeStr = `${pad(hour)}:${pad(minute)}`;

  return { date: dateStr, time: timeStr };
};

const pickRandomLeague = () => {
  return LEAGUES_BANK[Math.floor(Math.random() * LEAGUES_BANK.length)];
};

module.exports = {
  LEAGUES_BANK,
  generateTeamNames,
  generateFixturesTeams,
  generateFixtureSchedule,
  pickRandomLeague
};