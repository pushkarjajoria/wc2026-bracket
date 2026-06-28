// FIFA World Cup 2026 — knockout bracket data (verified against the official schedule).
// Matches are ordered so that adjacent pairs feed the next round (M1&M2 -> R16_M1, etc.),
// which reproduces the real single-elimination tree.

export const BRACKET_SEED = [
  { id: "R32_M1",  no: 74, date: "2026-06-29", teams: ["Germany", "Paraguay"],                 venue: "Gillette Stadium, Foxborough" },
  { id: "R32_M2",  no: 77, date: "2026-06-30", teams: ["France", "Sweden"],                     venue: "MetLife Stadium, East Rutherford" },
  { id: "R32_M3",  no: 73, date: "2026-06-28", teams: ["South Africa", "Canada"],               venue: "SoFi Stadium, Inglewood" },
  { id: "R32_M4",  no: 75, date: "2026-06-29", teams: ["Netherlands", "Morocco"],               venue: "Estadio BBVA, Guadalupe" },
  { id: "R32_M5",  no: 83, date: "2026-07-02", teams: ["Portugal", "Croatia"],                  venue: "BMO Field, Toronto" },
  { id: "R32_M6",  no: 84, date: "2026-07-02", teams: ["Spain", "Austria"],                     venue: "SoFi Stadium, Inglewood" },
  { id: "R32_M7",  no: 81, date: "2026-07-01", teams: ["USA", "Bosnia and Herzegovina"],        venue: "Levi's Stadium, Santa Clara" },
  { id: "R32_M8",  no: 82, date: "2026-07-01", teams: ["Belgium", "Senegal"],                   venue: "Lumen Field, Seattle" },
  { id: "R32_M9",  no: 76, date: "2026-06-29", teams: ["Brazil", "Japan"],                      venue: "NRG Stadium, Houston" },
  { id: "R32_M10", no: 78, date: "2026-06-30", teams: ["Ivory Coast", "Norway"],                venue: "AT&T Stadium, Arlington" },
  { id: "R32_M11", no: 79, date: "2026-06-30", teams: ["Mexico", "Ecuador"],                    venue: "Estadio Azteca, Mexico City" },
  { id: "R32_M12", no: 80, date: "2026-07-01", teams: ["England", "DR Congo"],                  venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: "R32_M13", no: 86, date: "2026-07-03", teams: ["Argentina", "Cape Verde"],              venue: "Hard Rock Stadium, Miami Gardens" },
  { id: "R32_M14", no: 88, date: "2026-07-03", teams: ["Australia", "Egypt"],                   venue: "AT&T Stadium, Arlington" },
  { id: "R32_M15", no: 85, date: "2026-07-02", teams: ["Switzerland", "Algeria"],              venue: "BC Place, Vancouver" },
  { id: "R32_M16", no: 87, date: "2026-07-03", teams: ["Colombia", "Ghana"],                    venue: "Arrowhead Stadium, Kansas City" },
];

// Metadata (date + venue) for the derived rounds, keyed by internal match id.
export const ROUND_META = {
  R16_M1: { no: 89,  date: "2026-07-04", venue: "Lincoln Financial Field, Philadelphia" },
  R16_M2: { no: 90,  date: "2026-07-04", venue: "NRG Stadium, Houston" },
  R16_M3: { no: 93,  date: "2026-07-06", venue: "AT&T Stadium, Arlington" },
  R16_M4: { no: 94,  date: "2026-07-06", venue: "Lumen Field, Seattle" },
  R16_M5: { no: 91,  date: "2026-07-05", venue: "MetLife Stadium, East Rutherford" },
  R16_M6: { no: 92,  date: "2026-07-05", venue: "Estadio Azteca, Mexico City" },
  R16_M7: { no: 95,  date: "2026-07-07", venue: "Mercedes-Benz Stadium, Atlanta" },
  R16_M8: { no: 96,  date: "2026-07-07", venue: "BC Place, Vancouver" },
  QF_M1:  { no: 97,  date: "2026-07-09", venue: "Gillette Stadium, Foxborough" },
  QF_M2:  { no: 98,  date: "2026-07-10", venue: "SoFi Stadium, Inglewood" },
  QF_M3:  { no: 99,  date: "2026-07-11", venue: "Hard Rock Stadium, Miami Gardens" },
  QF_M4:  { no: 100, date: "2026-07-11", venue: "Arrowhead Stadium, Kansas City" },
  SF_M1:  { no: 101, date: "2026-07-14", venue: "AT&T Stadium, Arlington" },
  SF_M2:  { no: 102, date: "2026-07-15", venue: "Mercedes-Benz Stadium, Atlanta" },
  FINAL:  { no: 104, date: "2026-07-19", venue: "MetLife Stadium, East Rutherford" },
};

export const ROUNDS = ["R32", "R16", "QF", "SF", "FINAL"];

export const ROUND_LABELS = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-Finals",
  SF: "Semi-Finals",
  FINAL: "Final",
};

export const ROUND_WIRING = {
  R32: {
    matches: ["R32_M1","R32_M2","R32_M3","R32_M4","R32_M5","R32_M6","R32_M7","R32_M8",
              "R32_M9","R32_M10","R32_M11","R32_M12","R32_M13","R32_M14","R32_M15","R32_M16"],
    nextRound: "R16",
    pairInto: ["R16_M1","R16_M1","R16_M2","R16_M2","R16_M3","R16_M3","R16_M4","R16_M4",
               "R16_M5","R16_M5","R16_M6","R16_M6","R16_M7","R16_M7","R16_M8","R16_M8"],
  },
  R16: {
    matches: ["R16_M1","R16_M2","R16_M3","R16_M4","R16_M5","R16_M6","R16_M7","R16_M8"],
    nextRound: "QF",
    pairInto: ["QF_M1","QF_M1","QF_M2","QF_M2","QF_M3","QF_M3","QF_M4","QF_M4"],
  },
  QF: {
    matches: ["QF_M1","QF_M2","QF_M3","QF_M4"],
    nextRound: "SF",
    pairInto: ["SF_M1","SF_M1","SF_M2","SF_M2"],
  },
  SF: {
    matches: ["SF_M1","SF_M2"],
    nextRound: "FINAL",
    pairInto: ["FINAL","FINAL"],
  },
  FINAL: { matches: ["FINAL"], nextRound: null, pairInto: [] },
};

// All match ids in order, plus a helper to know how many picks a full bracket needs (31).
export const ALL_MATCH_IDS = [
  ...ROUND_WIRING.R32.matches,
  ...ROUND_WIRING.R16.matches,
  ...ROUND_WIRING.QF.matches,
  ...ROUND_WIRING.SF.matches,
  "FINAL",
];

export const SEED_BY_ID = Object.fromEntries(BRACKET_SEED.map((m) => [m.id, m]));

// Works for both user picks and real results — same shape, different input.
// Returns the matchups for `round`, deriving teams from the previous round's winners.
export function computeRoundMatchups(picksOrResults, round) {
  if (round === "R32") return BRACKET_SEED;
  const prevRound = { R16: "R32", QF: "R16", SF: "QF", FINAL: "SF" }[round];
  const wiring = ROUND_WIRING[prevRound];
  const matchups = {};
  const order = [];
  wiring.matches.forEach((matchId, i) => {
    const winner = picksOrResults[matchId];
    const nextMatchId = wiring.pairInto[i];
    if (!matchups[nextMatchId]) {
      matchups[nextMatchId] = {
        id: nextMatchId,
        teams: [],
        date: ROUND_META[nextMatchId]?.date,
        venue: ROUND_META[nextMatchId]?.venue,
      };
      order.push(nextMatchId);
    }
    matchups[nextMatchId].teams.push(winner ?? "TBD");
  });
  return order.map((id) => matchups[id]);
}

export const FLAG_CODES = {
  "Germany": "de", "Paraguay": "py", "France": "fr", "Sweden": "se",
  "South Africa": "za", "Canada": "ca", "Netherlands": "nl", "Morocco": "ma",
  "Portugal": "pt", "Croatia": "hr", "Spain": "es", "Austria": "at",
  "USA": "us", "Bosnia and Herzegovina": "ba", "Belgium": "be", "Senegal": "sn",
  "Brazil": "br", "Japan": "jp", "Ivory Coast": "ci", "Norway": "no",
  "Mexico": "mx", "Ecuador": "ec", "England": "gb-eng", "DR Congo": "cd",
  "Argentina": "ar", "Cape Verde": "cv", "Australia": "au", "Egypt": "eg",
  "Switzerland": "ch", "Algeria": "dz", "Colombia": "co", "Ghana": "gh",
};

export function flagUrl(team) {
  const code = FLAG_CODES[team];
  return code ? `https://flagcdn.com/48x36/${code}.png` : null;
}
