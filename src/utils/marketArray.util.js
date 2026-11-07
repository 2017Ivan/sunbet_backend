const MARKET_LABELS = {
  '1X2': '1X2 | Full Time',
  Double_Chance: 'Double Chance | Full Time',
  BTTS: 'Both Teams To Score | Full Time',
  Over_Under: 'Over/Under | Full Time',
  Draw_No_Bet: 'Draw No Bet | Full Time',
  Correct_Score: 'Correct Score | Full Time',
  Total_Goals: 'Total Goals Exact | Full Time',
  BTTS_Win: '1X2 and Both Teams To Score | Full Time',
  Odd_Even: 'Odd/Even | Full Time',
  Asian_Handicap: 'Asian Handicap | Full Time',
  Asian_Handicap_Half: 'Asian Handicap | First Half',
  Corner_Line: 'Total Corners Over/Under | Full Time',
  Corner_Line_Half: 'Total Corners Over/Under | First Half',
  Corner_Asian: 'Corner Asian Handicap | Full Time',
  Card_Line: 'Total Bookings Over/Under | Full Time',
  Card_Asian: 'Card Asian Handicap | Full Time',
  Goal_Line_Fixed: 'Fixed Goal Lines',
  Goal_Line_Half: 'Over/Under | First Half'
};

const formatSelectionName = (key, marketKey) => {
  if (marketKey === 'BTTS_Win') {
    const [result, answer] = String(key).split('_');
    const resultLabel = result === 'Home' ? '1' : result === 'Away' ? '2' : 'X';
    return `${resultLabel} & ${answer}`;
  }
  return String(key)
    .replace(/^OVER_/, 'Over ')
    .replace(/^UNDER_/, 'Under ')
    .replace(/_/g, ' ');
};

const isValidOdds = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) && Number(value) > 1;

const toMarketArray = (odds, homeTeam = 'Home', awayTeam = 'Away') => {
  if (Array.isArray(odds)) {
    return odds
      .filter((market) => market && typeof market.market === 'string' && Array.isArray(market.selections))
      .map((market) => ({
        market: market.market,
        selections: market.selections
          .filter((selection) => selection && typeof selection.name === 'string' && isValidOdds(selection.odds))
          .map((selection) => ({ name: selection.name, odds: Number(selection.odds) }))
      }))
      .filter((market) => market.selections.length > 0);
  }

  if (!odds || typeof odds !== 'object') return [];

  const markets = [];
  for (const [marketKey, selections] of Object.entries(odds)) {
    if (!selections || typeof selections !== 'object' || Array.isArray(selections)) continue;

    if (marketKey === 'Clean_Sheet') {
      for (const [side, team] of [['Home', homeTeam], ['Away', awayTeam]]) {
        const yesOdds = selections[`${side}_Yes`] ?? selections[side];
        const noOdds = selections[`${side}_No`];
        const teamYesOdds = side === 'Home' ? selections.Home : selections.Away;
        const yes = yesOdds ?? teamYesOdds;
        if (!isValidOdds(yes) && !isValidOdds(noOdds)) continue;

        markets.push({
          market: `Clean Sheet | ${team} | Full Time`,
          selections: [
            ...(!isValidOdds(yes) ? [] : [{ name: 'Yes', odds: Number(yes) }]),
            ...(!isValidOdds(noOdds) ? [] : [{ name: 'No', odds: Number(noOdds) }])
          ]
        });
      }
      continue;
    }

    const entries = marketKey === '1X2'
      ? ['1', 'X', '2'].filter((key) => Object.prototype.hasOwnProperty.call(selections, key))
        .map((key) => [key, selections[key]])
      : Object.entries(selections);
    const normalizedSelections = entries
      .filter(([, value]) => isValidOdds(value))
      .map(([name, value]) => ({
        name: formatSelectionName(name, marketKey),
        odds: Number(value)
      }));
    if (normalizedSelections.length) {
      markets.push({
        market: MARKET_LABELS[marketKey] || marketKey.replace(/_/g, ' '),
        selections: normalizedSelections
      });
    }
  }

  return markets;
};

const marketKeyForTitle = (title, homeTeam, awayTeam) => {
  const directKey = Object.keys(MARKET_LABELS).find((key) => MARKET_LABELS[key] === title);
  if (directKey) return directKey;

  if (title === `Clean Sheet | ${homeTeam} | Full Time`
    || title === `Clean Sheet | ${awayTeam} | Full Time`) {
    return 'Clean_Sheet';
  }
  return null;
};

const selectionNameForKey = (marketKey, outcomeKey) => {
  if (marketKey === 'Over_Under') return formatSelectionName(outcomeKey);
  if (marketKey === 'BTTS_Win') {
    const [result, answer] = String(outcomeKey).split('_');
    const resultLabel = result === 'Home' ? '1' : result === 'Away' ? '2' : 'X';
    return `${resultLabel} & ${answer}`;
  }
  if (marketKey === 'Clean_Sheet') {
    return String(outcomeKey).replace(/^(Home|Away)_/, '');
  }
  return outcomeKey;
};

const getMarketSelectionOdds = (markets, marketKey, outcomeKey, homeTeam, awayTeam) => {
  if (!Array.isArray(markets)) {
    const selections = markets?.[marketKey];
    return selections && Object.prototype.hasOwnProperty.call(selections, outcomeKey)
      ? selections[outcomeKey]
      : undefined;
  }

  const title = marketKey === 'Clean_Sheet'
    ? `Clean Sheet | ${String(outcomeKey).startsWith('Away_') ? awayTeam : homeTeam} | Full Time`
    : MARKET_LABELS[marketKey];
  if (!title) return undefined;

  const market = markets.find((item) => item?.market === title);
  if (!market || !Array.isArray(market.selections)) return undefined;

  const selectionName = selectionNameForKey(marketKey, outcomeKey);
  const selection = market.selections.find((item) => item?.name === selectionName);
  return selection?.odds;
};

module.exports = {
  MARKET_LABELS,
  toMarketArray,
  marketKeyForTitle,
  getMarketSelectionOdds
};
