import {
  BRACKET_SEED,
  ROUND_WIRING,
  ROUND_LABELS,
  ROUNDS,
  SEED_BY_ID,
  ROUND_META,
  computeRoundMatchups,
  flagUrl,
} from "./data/bracket.js";
import { calculateScore } from "./scoring.js";

// ---------- small helpers ----------
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function flagHtml(team, cls = "team-flag") {
  const url = flagUrl(team);
  if (!url) return `<span class="${cls}-fallback" aria-hidden="true">🏳️</span>`;
  return `<img class="${cls}" src="${url}" alt="${esc(team)} flag" loading="lazy" width="32" height="24" />`;
}

// "1" or, when decided on penalties, "1 (4)".
function teamScoreText(scoreObj, team) {
  if (!scoreObj || !scoreObj.goals || scoreObj.goals[team] === undefined) return "";
  const g = scoreObj.goals[team];
  const p = scoreObj.pens?.[team];
  return p !== undefined && p !== null ? `${g} (${p})` : `${g}`;
}

function metaHtml(match) {
  if (!match.date && !match.venue) return "";
  const parts = [];
  if (match.date) parts.push(`📅 ${esc(fmtDate(match.date))}`);
  if (match.venue) parts.push(esc(match.venue));
  return `<div class="match-meta">${parts.map((p) => `<span>${p}</span>`).join("<span>·</span>")}</div>`;
}

// ---------- match card ----------
// mode "predict": clickable rows; `pick` = current selection.
// mode "view":    static rows; `pick` = a submitter's pick; `result` = real winner (optional).
// `locked`:       match already finished — rows are static and shown as decided,
//                 marked 🔒 because they don't count toward a late entrant's score.
export function renderMatchCard(match, { mode = "predict", pick, result, score, locked = false } = {}) {
  const hasPick = !!pick;
  const rows = match.teams.map((team) => {
    if (team === "TBD") {
      return `<div class="team-row tbd"><span class="team-flag-fallback" aria-hidden="true">·</span><span class="team-name">TBD</span></div>`;
    }
    const selected = pick === team;
    if (mode === "predict" && !locked) {
      return `<button type="button" class="team-row" aria-pressed="${selected}" data-match="${esc(match.id)}" data-team="${esc(team)}">
        ${flagHtml(team)}
        <span class="team-name">${esc(team)}</span>
        <span class="team-check" aria-hidden="true">✓</span>
      </button>`;
    }
    // static row (view mode, or a locked/decided match in the predict flow)
    let resClass = "";
    let badge = "";
    if (locked) {
      if (selected) {
        resClass = "res-locked";
        badge = `<span class="res-badge lock" title="Already decided — not scored for late entries">🔒</span>`;
      }
    } else if (selected) {
      if (result) {
        const correct = result === team;
        resClass = correct ? "res-correct" : "res-wrong";
        badge = `<span class="res-badge ${correct ? "ok" : "no"}" title="${correct ? "Correct pick" : "Wrong pick"}">${correct ? "✅" : "❌"}</span>`;
      } else {
        badge = `<span class="res-badge pending" title="Not played yet">⬜</span>`;
      }
    }
    const sc = teamScoreText(score, team);
    const scoreSpan = sc ? `<span class="team-score">${esc(sc)}</span>` : "";
    return `<div class="team-row view ${resClass}" aria-pressed="${selected}">
      ${flagHtml(team)}
      <span class="team-name">${esc(team)}</span>
      ${scoreSpan}
      ${badge}
    </div>`;
  });

  return `<div class="match-card ${hasPick ? "has-pick" : ""} ${locked ? "locked" : ""}">
    ${rows.join("")}
    ${metaHtml(match)}
  </div>`;
}

export function renderRoundCards(round, matchups, picks, mode = "predict", ctx = {}) {
  const { locked, results, scores } = ctx;
  const gridCls = round === "R32" || round === "R16" ? "cards grid-2" : "cards";
  const cards = matchups
    .map((m) => {
      const isLocked = !!locked?.has(m.id);
      return renderMatchCard(m, {
        mode,
        pick: picks[m.id],
        locked: isLocked,
        result: isLocked ? results?.[m.id] : undefined,
        score: isLocked ? scores?.[m.id] : undefined,
      });
    })
    .join("");
  return `<div class="${gridCls}">${cards}</div>`;
}

// ---------- name entry ----------
export function renderNameEntry({ resumeName = "", error = "", value = "" } = {}) {
  const resume = resumeName
    ? `<div class="resume-banner">
         <strong>Welcome back, ${esc(resumeName)}.</strong>
         <div class="small muted">You have an unfinished bracket saved on this device.</div>
         <div class="row">
           <button class="btn btn-primary" data-action="resume">Resume my bracket</button>
           <button class="btn btn-ghost" data-action="startover">Start over</button>
         </div>
       </div>`
    : "";
  return `<section class="screen name-entry">
    ${resume}
    <h2 class="section-title">Make your bracket</h2>
    <p class="blurb">Pick a winner for every knockout match, from the Round of 32 to the Final. One entry per person — locked once you submit.</p>
    <input id="name-input" class="name-input" type="text" inputmode="text" autocomplete="name"
           placeholder="Your name" maxlength="40" value="${esc(value)}" aria-label="Your name" />
    <div class="field-error" role="alert">${esc(error)}</div>
    <button class="btn btn-primary btn-block" data-action="start">Start picking →</button>
    <div class="entry-or"><span>or</span></div>
    <button class="btn btn-ghost btn-block" data-action="view-standings">View standings &amp; everyone’s brackets</button>
  </section>`;
}

// ---------- predict ----------
export function renderPredict(state, reachable, locked = new Set()) {
  const { currentRound, picks } = state;
  const matchups = computeRoundMatchups(picks, currentRound);
  const total = matchups.length;
  const picked = matchups.filter((m) => picks[m.id]).length;
  const done = picked === total;
  const lockedHere = matchups.filter((m) => locked.has(m.id)).length;

  const tabs = ROUNDS.map((r) => {
    const sel = r === currentRound;
    const enabled = reachable.has(r);
    return `<button type="button" class="round-tab" role="tab" aria-selected="${sel}" ${enabled ? "" : "disabled"} data-round="${r}">${ROUND_LABELS[r]}</button>`;
  }).join("");

  const lockedNote = lockedHere
    ? `<div class="info-banner">🔒 ${lockedHere} match${lockedHere > 1 ? "es" : ""} already finished — filled in for you and not scored, so you start from the open games.</div>`
    : "";

  return `<section class="screen">
    <div class="round-bar">
      <div class="round-tabs" role="tablist" aria-label="Tournament rounds">${tabs}</div>
      <div class="round-head">
        <span class="round-name">${ROUND_LABELS[currentRound]}</span>
        <button type="button" class="progress-pill ${done ? "done" : ""}" data-action="scroll-unpicked" aria-live="polite">${picked} / ${total} picked</button>
      </div>
    </div>
    ${lockedNote}
    ${renderRoundCards(currentRound, matchups, picks, "predict", {
      locked,
      results: state.results,
      scores: state.scores,
    })}
  </section>`;
}

// ---------- review ----------
export function renderReview(state, datePassed, locked = new Set()) {
  const groups = ROUNDS.map((round) => {
    const matchups = computeRoundMatchups(state.picks, round);
    const rows = matchups
      .map((m) => {
        const pick = state.picks[m.id] || "—";
        const isLocked = locked.has(m.id);
        const tag = isLocked
          ? `<span class="lock-tag" title="Already decided — not scored for you">🔒</span>`
          : "";
        return `<div class="review-row ${isLocked ? "locked" : ""}">
          <span class="rid mono">${esc(m.id)}</span>
          ${flagHtml(pick)}
          <span class="team-name">${esc(pick)}</span>
          ${tag}
        </div>`;
      })
      .join("");
    return `<div class="review-group"><h3>${ROUND_LABELS[round]}</h3>${rows}</div>`;
  }).join("");

  const lockedCount = locked.size;
  const banner = lockedCount
    ? `<div class="info-banner">🔒 ${lockedCount} already-finished match${lockedCount > 1 ? "es are" : " is"} filled in with the real result and won’t count toward your score.</div>`
    : datePassed
    ? `<div class="warn-banner">⚠️ Some matches may have already kicked off. You can still submit.</div>`
    : "";

  return `<section class="screen">
    <h2 class="section-title">Review your bracket</h2>
    <p class="muted small">Check everything, then lock it in. You can’t change picks after submitting.</p>
    ${banner}
    ${groups}
    <div style="display:flex; gap:10px; margin-top:8px;">
      <button class="btn btn-ghost" data-action="edit-picks">← Edit picks</button>
    </div>
  </section>`;
}

// ---------- leaderboard ----------
export function renderLeaderboard(state, ranked, hasResults) {
  const tab = state.viewTab || "leaderboard";
  const tabs = `<div class="tabs" role="tablist">
    <button class="tab" role="tab" aria-selected="${tab === "leaderboard"}" data-tab="leaderboard">Leaderboard</button>
    <button class="tab" role="tab" aria-selected="${tab === "all"}" data-tab="all">All Brackets</button>
  </div>`;

  let body;
  if (tab === "leaderboard") body = leaderboardTable(state, ranked, hasResults);
  else body = renderAllBrackets(state);

  const submitted = !!(
    state.name &&
    (state.submissions || []).some(
      (s) => s.name.toLowerCase() === state.name.toLowerCase()
    )
  );
  const cta = submitted
    ? `<span class="muted small">You’re entered as <strong>${esc(state.name)}</strong> ✓</span>`
    : `<button class="btn btn-primary" data-action="go-predict">Make your bracket →</button>`;

  return `<section class="screen">
    <div class="lb-header">
      <h2 class="section-title" style="margin:0">Standings ${state.demo ? '<span class="demo-tag">DEMO</span>' : ""}</h2>
      ${cta}
    </div>
    ${tabs}
    ${body}
  </section>`;
}

function medal(i) {
  return ["🥇", "🥈", "🥉"][i] || `${i + 1}`;
}

function leaderboardTable(state, ranked, hasResults) {
  if (!ranked.length) {
    return `<div class="empty">No brackets yet — be the first to predict!</div>`;
  }
  const rows = ranked
    .map((r, i) => {
      const me = state.name && r.name.toLowerCase() === state.name.toLowerCase();
      const scoreTxt = hasResults ? `${r.score}` : "—";
      const meta = hasResults
        ? `${r.correct}/${r.played} played`
        : `submitted ${fmtDate((r.submittedAt || "").slice(0, 10))}`;
      return `<div class="lb-row ${me ? "me" : ""}">
        <span class="lb-rank">${hasResults ? medal(i) : i + 1}</span>
        <span class="lb-name"><button data-view-person="${esc(r.name)}">${esc(r.name)}${me ? " (you)" : ""}</button></span>
        <span class="lb-meta">${esc(meta)}</span>
        <span class="lb-score">${scoreTxt}</span>
      </div>`;
    })
    .join("");
  const note = hasResults
    ? ""
    : `<p class="muted small" style="margin-top:10px">Matches haven’t started yet — everyone’s at 0 pts.</p>`;
  return `<div class="lb-list">${rows}</div>${note}`;
}

// ---------- all brackets ----------
export function renderAllBrackets(state) {
  const subs = state.submissions || [];
  if (!subs.length) return `<div class="empty">No brackets to show yet.</div>`;

  const idx = Math.min(Math.max(state.viewPerson || 0, 0), subs.length - 1);
  const person = subs[idx];
  const me = state.name && person.name.toLowerCase() === state.name.toLowerCase();
  const locked = new Set(person.lockedMatches || []);
  const options = subs
    .map((s, i) => `<option value="${i}" ${i === idx ? "selected" : ""}>${esc(s.name)}</option>`)
    .join("");

  let scoreLabel = "";
  if (state.results && Object.keys(state.results).length > 0) {
    const { score, correct, played } = calculateScore(
      person.picks,
      state.results,
      person.lockedMatches
    );
    scoreLabel = ` · <span class="mono">${score} pts · ${correct}/${played}</span>`;
  }
  const lockedLabel = locked.size
    ? ` · <span class="muted small">🔒 ${locked.size} auto-filled (joined late)</span>`
    : "";

  const picker = `<div class="person-picker">
      <button class="nav-btn" data-action="person-prev" aria-label="Previous person">‹</button>
      <select id="person-select" aria-label="Choose whose bracket to view">${options}</select>
      <button class="nav-btn" data-action="person-next" aria-label="Next person">›</button>
    </div>
    <div class="viewing-label">Viewing <strong>${esc(person.name)}${me ? " (you)" : ""}</strong>${scoreLabel}${lockedLabel}</div>`;

  // Mobile: vertical cards for this one person. Desktop: horizontal tree for this one person.
  const mobileCards = ROUNDS.map((round) => {
    const matchups = computeRoundMatchups(person.picks, round);
    const cards = matchups
      .map((m) =>
        renderMatchCard(m, {
          mode: "view",
          pick: person.picks[m.id],
          result: state.results?.[m.id],
          score: state.scores?.[m.id],
          locked: locked.has(m.id),
        })
      )
      .join("");
    return `<div class="ab-round-label">${ROUND_LABELS[round]}</div><div class="cards">${cards}</div>`;
  }).join("");

  return `${lastUpdatedHtml(state)}
    ${picker}
    <div class="ab-mobile">${mobileCards}</div>
    ${bracketTree(person.picks, state.results, state.scores, me, locked)}`;
}

function lastUpdatedHtml(state) {
  if (!state.results || !state.resultsMeta?.lastUpdated) return "";
  const d = new Date(state.resultsMeta.lastUpdated);
  return `<div class="last-updated">Results updated: ${esc(d.toLocaleString())}</div>`;
}

function bracketTree(picks, results, scores, me = false, locked = new Set()) {
  const cols = ROUNDS.map((round) => {
    const matchups = computeRoundMatchups(picks, round);
    const slots = matchups
      .map((m) => {
        const scoreObj = scores?.[m.id];
        const isLocked = locked.has(m.id);
        const teams = m.teams
          .map((team) => {
            if (team === "TBD") return `<div class="bt-team"><span class="nm muted">TBD</span></div>`;
            const isPick = picks[m.id] === team;
            const result = results?.[m.id];
            let cls = "";
            if (isPick) cls = "win";
            if (isPick && result) cls = isLocked ? "locked" : result === team ? "correct" : "wrong";
            const flag = flagUrl(team)
              ? `<img class="flag" src="${flagUrl(team)}" alt="" width="20" height="15" />`
              : `<span class="flag" aria-hidden="true"></span>`;
            const sc = teamScoreText(scoreObj, team);
            const scoreSpan = sc ? `<span class="bt-score">${esc(sc)}</span>` : "";
            let badge = "";
            if (isPick && isLocked) badge = `<span class="bt-badge">🔒</span>`;
            else if (isPick && result) badge = `<span class="bt-badge">${result === team ? "✅" : "❌"}</span>`;
            return `<div class="bt-team ${cls}">${flag}<span class="nm">${esc(team)}</span>${scoreSpan}${badge}</div>`;
          })
          .join("");
        return `<div class="bt-match">${teams}</div>`;
      })
      .join("");
    return `<div class="bt-column"><div class="bt-round-title">${ROUND_LABELS[round]}</div><div class="bt-slots">${slots}</div></div>`;
  }).join("");
  return `<div class="bracket-tree ${me ? "me" : ""}">${cols}</div>`;
}

// ---------- submit confirm modal ----------
export function confirmModalHtml() {
  return `<div class="modal-overlay" data-action="modal-cancel">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h3 id="modal-title">Lock in your bracket?</h3>
      <p>Once submitted, your picks cannot be changed.</p>
      <div class="row">
        <button class="btn btn-ghost btn-block" data-action="modal-cancel">Cancel</button>
        <button class="btn btn-primary btn-block" data-action="modal-confirm">Yes, lock it in</button>
      </div>
    </div>
  </div>`;
}
