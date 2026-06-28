#!/usr/bin/env node
// Update match results, then commit + push so GitHub Pages redeploys.
//
//   node update-results.mjs --list                 show every match + current status
//   node update-results.mjs R32_M9=Brazil          set a winner (commits + pushes)
//   node update-results.mjs R32_M9=Brazil QF_M1=Germany -m "Jun 29 results"
//   node update-results.mjs R32_M9=                 unset (mistake fix)
//   node update-results.mjs R32_M9=Brazil --dry-run preview only, no write
//   node update-results.mjs R32_M9=Brazil --no-push commit locally but don't push
//
// Team names are matched case-insensitively and accept common aliases
// (e.g. "usa", "drc", "cote d'ivoire", "bosnia").

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  ALL_MATCH_IDS,
  BRACKET_SEED,
  SEED_BY_ID,
  ROUND_META,
  ROUND_WIRING,
  ROUNDS,
  ROUND_LABELS,
  FLAG_CODES,
  computeRoundMatchups,
} from "./data/bracket.js";

const RESULTS_PATH = new URL("./data/results.json", import.meta.url);

const ALIASES = {
  "usa": "USA", "united states": "USA", "us": "USA",
  "drc": "DR Congo", "dr congo": "DR Congo", "congo dr": "DR Congo", "congo": "DR Congo",
  "bosnia": "Bosnia and Herzegovina", "bih": "Bosnia and Herzegovina",
  "bosnia & herz.": "Bosnia and Herzegovina", "bosnia and herzegovina": "Bosnia and Herzegovina",
  "cote d'ivoire": "Ivory Coast", "côte d'ivoire": "Ivory Coast", "ivory coast": "Ivory Coast",
  "cabo verde": "Cape Verde", "cape verde": "Cape Verde",
};
const CANON = {};
for (const name of Object.keys(FLAG_CODES)) CANON[name.toLowerCase()] = name;
for (const [k, v] of Object.entries(ALIASES)) CANON[k] = v;

function canonTeam(raw) {
  return CANON[String(raw).trim().toLowerCase()] || null;
}

function loadResults() {
  try {
    return JSON.parse(readFileSync(RESULTS_PATH, "utf8"));
  } catch {
    return { version: 1, lastUpdated: null, results: {} };
  }
}

function matchTeams(doc, matchId) {
  // R32 teams are fixed; later rounds derive from results already entered.
  if (SEED_BY_ID[matchId]) return SEED_BY_ID[matchId].teams;
  const round = ROUNDS.find((r) =>
    ROUND_WIRING[r].matches.includes(matchId) || (r === "FINAL" && matchId === "FINAL")
  );
  if (!round) return [];
  const m = computeRoundMatchups(doc.results, round).find((x) => x.id === matchId);
  return m ? m.teams : [];
}

function fmt(matchId, doc) {
  const teams = matchTeams(doc, matchId);
  const meta = SEED_BY_ID[matchId] || ROUND_META[matchId] || {};
  const winner = doc.results[matchId];
  const vs = teams.length ? teams.join(" vs ") : "(teams TBD)";
  const status = winner ? `WINNER: ${winner}` : "—";
  return `  ${matchId.padEnd(8)} ${(meta.date || "").padEnd(11)} ${vs.padEnd(34)} ${status}`;
}

function printList(doc) {
  for (const round of ROUNDS) {
    const ids = round === "FINAL" ? ["FINAL"] : ROUND_WIRING[round].matches;
    console.log(`\n${ROUND_LABELS[round]}`);
    for (const id of ids) console.log(fmt(id, doc));
  }
  console.log("");
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 18).join("\n").replace(/^\/\/ ?/gm, ""));
    return;
  }

  const doc = loadResults();
  const flags = { dryRun: false, push: true, commit: true, message: "" };
  const sets = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--list" || a === "-l") return printList(doc);
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--no-push") flags.push = false;
    else if (a === "--no-commit") { flags.commit = false; flags.push = false; }
    else if (a === "-m" || a === "--message") flags.message = args[++i] || "";
    else if (a.includes("=")) sets.push(a);
    else { console.error(`Unrecognized argument: ${a}`); process.exit(1); }
  }

  if (!sets.length) { console.error("Nothing to set. Use --list to see matches."); process.exit(1); }

  const applied = [];
  for (const token of sets) {
    const eq = token.indexOf("=");
    const matchId = token.slice(0, eq).trim();
    const rawTeam = token.slice(eq + 1).trim();

    if (!ALL_MATCH_IDS.includes(matchId)) {
      console.error(`Unknown match id: "${matchId}". Use --list to see valid ids.`);
      process.exit(1);
    }
    if (rawTeam === "") {
      delete doc.results[matchId];
      applied.push(`${matchId} → (cleared)`);
      continue;
    }
    const team = canonTeam(rawTeam);
    if (!team) {
      console.error(`Unknown team: "${rawTeam}".`);
      process.exit(1);
    }
    const teams = matchTeams(doc, matchId);
    if (teams.length === 2 && !teams.includes("TBD") && !teams.includes(team)) {
      console.error(`"${team}" is not in ${matchId} (${teams.join(" vs ")}). ` +
        `Did an earlier-round result not get entered yet?`);
      process.exit(1);
    }
    if (teams.includes("TBD")) {
      console.warn(`! ${matchId}: opponent not yet determined — setting "${team}" anyway.`);
    }
    doc.results[matchId] = team;
    applied.push(`${matchId} → ${team}`);
  }

  doc.lastUpdated = new Date().toISOString();
  const json = JSON.stringify(doc, null, 2) + "\n";

  console.log("\nChanges:");
  applied.forEach((a) => console.log("  " + a));

  if (flags.dryRun) {
    console.log("\n--dry-run: not writing or committing.\n");
    return;
  }

  writeFileSync(RESULTS_PATH, json);
  console.log(`\nWrote data/results.json (lastUpdated ${doc.lastUpdated}).`);

  if (!flags.commit) return;
  const msg = flags.message || `Results: ${applied.join(", ")}`;
  try {
    execSync("git add data/results.json", { stdio: "inherit" });
    execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: "inherit" });
    if (flags.push) {
      execSync("git push", { stdio: "inherit" });
      console.log("\nPushed. GitHub Pages will redeploy in ~60s.\n");
    } else {
      console.log("\nCommitted locally (not pushed).\n");
    }
  } catch (e) {
    console.error("\nGit step failed:", e.message);
    process.exit(1);
  }
}

main();
