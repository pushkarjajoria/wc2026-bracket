import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import {
  renderNameEntry,
  renderPredict,
  renderReview,
  renderLeaderboard,
  renderAllBrackets,
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

// all brackets — one person at a time, with switcher + tree for that person
const st = { name: "Pushkar", submissions: subs, results, viewPerson: 1 };
html = renderAllBrackets(st);
assert.ok(html.includes("person-select"), "has person switcher");
assert.ok(html.includes("bracket-tree"), "renders the desktop tree");
assert.ok(html.includes("Viewing"), "shows whose bracket is displayed");
// viewPerson 1 is "Mum" — only that person should be named in the viewing label
assert.ok(html.includes("<strong>Mum</strong>"), "shows the selected person");
assert.ok(html.includes("✅") || html.includes("⬜"));

// XSS escaping for names
const evil = [{ name: '<img src=x onerror=alert(1)>', submittedAt: "2026-06-28T00:00:00Z", picks: {} }];
html = renderLeaderboard({ name: "", viewTab: "leaderboard", submissions: evil, results: {} }, rankSubmissions(evil, {}), false);
assert.ok(!html.includes("<img src=x"), "name must be HTML-escaped");
assert.ok(html.includes("&lt;img"));

// standings entry point on the name screen
assert.ok(renderNameEntry({}).includes('data-action="view-standings"'), "name screen offers View standings");

// browsing visitor (not submitted) sees a make-bracket CTA
const browse = renderLeaderboard({ name: "", viewTab: "leaderboard", submissions: subs, results }, rankSubmissions(subs, results), true);
assert.ok(browse.includes('data-action="go-predict"'), "browsing visitor sees make-bracket CTA");

// submitted viewer sees no make-bracket CTA
const mine = renderLeaderboard({ name: "Pushkar", viewTab: "leaderboard", submissions: subs, results }, rankSubmissions(subs, results), true);
assert.ok(!mine.includes('data-action="go-predict"'), "submitted viewer has no make-bracket CTA");
assert.ok(mine.includes("You’re entered"));

// results coloring shows up in all-brackets once results exist
const colored = renderAllBrackets({
  name: "Pushkar",
  submissions: subs,
  results: { R32_M1: "Germany", R32_M9: "Japan" }, // Pushkar: M1 correct, M9 wrong
  viewPerson: 0,
});
assert.ok(colored.includes("res-correct"), "correct pick gets green class");
assert.ok(colored.includes("res-wrong"), "wrong pick gets red class");

// scores show next to names, with badges
const withScores = renderAllBrackets({
  name: "Pushkar",
  submissions: subs,
  results: { R32_M3: "Canada" }, // Pushkar picked South Africa -> wrong
  scores: { R32_M3: { goals: { "South Africa": 0, "Canada": 1 } } },
  viewPerson: 0,
});
assert.ok(withScores.includes('class="team-score">1'), "renders Canada's goal next to the name");
assert.ok(withScores.includes('class="team-score">0'), "renders South Africa's goal");
assert.ok(withScores.includes("❌"), "wrong pick shows ❌ badge");
assert.ok(withScores.includes("bt-score"), "desktop tree shows the score too");

// penalty notation: "1 (4)"
const pens = renderAllBrackets({
  name: "Pushkar",
  submissions: subs,
  results: { R32_M3: "Canada" },
  scores: { R32_M3: { goals: { "South Africa": 1, "Canada": 1 }, pens: { "South Africa": 3, "Canada": 4 } } },
  viewPerson: 0,
});
assert.ok(pens.includes("1 (4)"), "penalty score uses bracket notation");

console.log("render smoke: all assertions passed");
