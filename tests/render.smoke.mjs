import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import {
  renderNameEntry,
  renderPredict,
  renderReview,
  renderLeaderboard,
  renderAllBracketsMobile,
  renderAllBracketsDesktop,
} from "../render.js";
import { rankSubmissions } from "../scoring.js";

const demo = JSON.parse(readFileSync(new URL("../data/predictions.demo.json", import.meta.url)));
const subs = demo.submissions;

// name entry
let html = renderNameEntry({ resumeName: "Pushkar", error: "oops" });
assert.ok(html.includes("Welcome back, Pushkar"));
assert.ok(html.includes("oops"));

// predict screen (fresh)
const reachable = new Set(["R32"]);
html = renderPredict({ currentRound: "R32", picks: {} }, reachable);
assert.ok(html.includes("Round of 32"));
assert.ok(html.includes("0 / 16 picked"));
assert.ok(html.includes("Germany") && html.includes("Paraguay"));

// review
html = renderReview({ picks: subs[0].picks }, true);
assert.ok(html.includes("already kicked off"));
assert.ok(html.includes("FINAL"));

// leaderboard with results
const results = { R32_M1: "Germany", FINAL: "Germany" };
const ranked = rankSubmissions(subs, results);
html = renderLeaderboard(
  { name: "Pushkar", viewTab: "leaderboard", submissions: subs, results },
  ranked,
  true
);
assert.ok(html.includes("🥇"));
assert.ok(html.includes("Pushkar"));
// Pushkar picked Germany for both -> 1 + 16 = 17 and should rank first
assert.equal(ranked[0].name, "Pushkar");
assert.equal(ranked[0].score, 17);

// all brackets
const st = { name: "Pushkar", submissions: subs, results, viewPerson: 0 };
html = renderAllBracketsMobile(st);
assert.ok(html.includes("person-select"));
assert.ok(html.includes("✅") || html.includes("⬜"));
html = renderAllBracketsDesktop(st);
assert.ok(html.includes("bracket-tree"));

// XSS escaping for names
const evil = [{ name: '<img src=x onerror=alert(1)>', submittedAt: "2026-06-28T00:00:00Z", picks: {} }];
html = renderLeaderboard({ name: "", viewTab: "leaderboard", submissions: evil, results: {} }, rankSubmissions(evil, {}), false);
assert.ok(!html.includes("<img src=x"), "name must be HTML-escaped");
assert.ok(html.includes("&lt;img"));

console.log("render smoke: all assertions passed");
