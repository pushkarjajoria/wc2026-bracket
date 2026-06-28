import { strict as assert } from "node:assert";
import {
  computeRoundMatchups,
  ALL_MATCH_IDS,
  ROUND_WIRING,
} from "../data/bracket.js";
import { calculateScore, rankSubmissions } from "../scoring.js";

let passed = 0;
const ok = (name) => { passed++; console.log("  ok -", name); };

// Helper: build picks where the top-listed team wins every match in a round.
function pickTopTeams(matchups, picks) {
  for (const m of matchups) picks[m.id] = m.teams[0];
  return picks;
}

// --- Bracket wiring reproduces the real tree ---
const picks = {};
const r32 = computeRoundMatchups({}, "R32");
assert.equal(r32.length, 16);
pickTopTeams(r32, picks);

const r16 = computeRoundMatchups(picks, "R16");
assert.equal(r16.length, 8);
assert.deepEqual(r16[0].teams, ["Germany", "France"], "R16_M1");
assert.deepEqual(r16[1].teams, ["South Africa", "Netherlands"], "R16_M2");
assert.deepEqual(r16[2].teams, ["Portugal", "Spain"], "R16_M3");
assert.deepEqual(r16[3].teams, ["USA", "Belgium"], "R16_M4");
assert.deepEqual(r16[4].teams, ["Brazil", "Ivory Coast"], "R16_M5");
assert.deepEqual(r16[5].teams, ["Mexico", "England"], "R16_M6");
assert.deepEqual(r16[6].teams, ["Argentina", "Australia"], "R16_M7");
assert.deepEqual(r16[7].teams, ["Switzerland", "Colombia"], "R16_M8");
ok("R32 -> R16 matchups match the official tree");

pickTopTeams(r16, picks);
const qf = computeRoundMatchups(picks, "QF");
assert.equal(qf.length, 4);
assert.deepEqual(qf[0].teams, ["Germany", "South Africa"], "QF_M1");
assert.deepEqual(qf[1].teams, ["Portugal", "USA"], "QF_M2");
assert.deepEqual(qf[2].teams, ["Brazil", "Mexico"], "QF_M3");
assert.deepEqual(qf[3].teams, ["Argentina", "Switzerland"], "QF_M4");
ok("R16 -> QF matchups correct");

pickTopTeams(qf, picks);
const sf = computeRoundMatchups(picks, "SF");
assert.equal(sf.length, 2);
assert.deepEqual(sf[0].teams, ["Germany", "Portugal"], "SF_M1");
assert.deepEqual(sf[1].teams, ["Brazil", "Argentina"], "SF_M2");
ok("QF -> SF matchups correct");

pickTopTeams(sf, picks);
const fin = computeRoundMatchups(picks, "FINAL");
assert.equal(fin.length, 1);
assert.deepEqual(fin[0].teams, ["Germany", "Brazil"], "FINAL");
ok("SF -> FINAL matchup correct");

// --- TBD propagation when a pick is missing ---
const partial = computeRoundMatchups({ R32_M1: "Germany" }, "R16");
assert.deepEqual(partial[0].teams, ["Germany", "TBD"]);
ok("missing pick yields TBD");

// --- 31 picks make a full bracket ---
assert.equal(ALL_MATCH_IDS.length, 31, "31 total matches");
ok("ALL_MATCH_IDS has 31 entries");

// --- pairInto arrays are internally consistent ---
for (const r of ["R32", "R16", "QF", "SF"]) {
  assert.equal(ROUND_WIRING[r].matches.length, ROUND_WIRING[r].pairInto.length);
}
ok("wiring matches/pairInto lengths align");

// --- Scoring ---
const results = { R32_M1: "Germany", R16_M1: "Germany", FINAL: "Brazil", R32_M2: "Sweden" };
const s = calculateScore(
  { R32_M1: "Germany", R16_M1: "Germany", FINAL: "Brazil", R32_M2: "France" },
  results
);
assert.deepEqual(s, { score: 1 + 2 + 16, correct: 3, played: 4 });
ok("calculateScore weights rounds and counts played/correct");

const ranked = rankSubmissions(
  [
    { name: "A", submittedAt: "2026-06-28T10:00:00Z", picks: { FINAL: "Brazil" } },     // 16
    { name: "B", submittedAt: "2026-06-28T09:00:00Z", picks: { R32_M1: "Germany" } },   // 1
    { name: "C", submittedAt: "2026-06-28T08:00:00Z", picks: { FINAL: "Brazil" } },     // 16, earlier
  ],
  { R32_M1: "Germany", FINAL: "Brazil" }
);
assert.deepEqual(ranked.map((r) => r.name), ["C", "A", "B"], "sorted by score then time");
ok("rankSubmissions sorts by score desc, then submit time asc");

console.log(`\nAll ${passed} checks passed.`);
