import {
  ROUNDS,
  ROUND_LABELS,
  ROUND_META,
  computeRoundMatchups,
} from "./data/bracket.js";
import { rankSubmissions } from "./scoring.js";
import {
  readPredictions,
  readResults,
  submitWithRetry,
  isDemo,
} from "./github.js";
import {
  PHASES,
  saveLocalDraft,
  loadLocalDraft,
  clearLocalDraft,
  titleCase,
} from "./state.js";
import {
  renderNameEntry,
  renderPredict,
  renderReview,
  renderLeaderboard,
  confirmModalHtml,
} from "./render.js";

const app = document.getElementById("app");
const ctaEl = document.getElementById("sticky-cta");
const modalRoot = document.getElementById("modal-root");

const state = {
  phase: PHASES.LOADING,
  name: "",
  nameValue: "",
  nameError: "",
  resumeName: "",
  picks: {},
  currentRound: "R32",
  submissions: [],
  results: {},
  scores: {},
  resultsMeta: {},
  viewTab: "leaderboard",
  viewPerson: 0,
  demo: isDemo(),
};

// ---------- bracket helpers ----------
function roundComplete(picks, round) {
  const m = computeRoundMatchups(picks, round);
  return m.length > 0 && m.every((x) => picks[x.id]);
}

function reachableRounds(picks) {
  const set = new Set(["R32"]);
  for (let i = 0; i < ROUNDS.length - 1; i++) {
    if (roundComplete(picks, ROUNDS[i])) set.add(ROUNDS[i + 1]);
    else break;
  }
  return set;
}

// When an earlier pick changes, drop downstream picks that no longer make sense.
function pruneDownstream(picks) {
  for (const round of ["R16", "QF", "SF", "FINAL"]) {
    for (const m of computeRoundMatchups(picks, round)) {
      if (picks[m.id] && !m.teams.includes(picks[m.id])) delete picks[m.id];
    }
  }
}

function allPicked(picks) {
  return ROUNDS.every((r) => roundComplete(picks, r));
}

function anyDatePassed(picks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const round of ROUNDS) {
    for (const m of computeRoundMatchups(picks, round)) {
      if (!picks[m.id]) continue;
      const d = m.date || ROUND_META[m.id]?.date;
      if (d && new Date(d + "T00:00:00") < today) return true;
    }
  }
  return false;
}

// ---------- rendering ----------
function render() {
  switch (state.phase) {
    case PHASES.NAME_ENTRY:
      app.innerHTML = renderNameEntry({
        resumeName: state.resumeName,
        error: state.nameError,
        value: state.nameValue,
      });
      setTimeout(() => document.getElementById("name-input")?.focus(), 0);
      break;
    case PHASES.PREDICT:
      app.innerHTML = renderPredict(state, reachableRounds(state.picks));
      break;
    case PHASES.REVIEW:
    case PHASES.SUBMITTING:
      app.innerHTML = renderReview(state, anyDatePassed(state.picks));
      break;
    case PHASES.LEADERBOARD: {
      const hasResults = Object.keys(state.results).length > 0;
      const ranked = rankSubmissions(state.submissions, state.results);
      app.innerHTML = renderLeaderboard(state, ranked, hasResults);
      break;
    }
    default:
      app.innerHTML = `<div class="loading">Loading…</div>`;
  }
  renderCTA();
}

function renderCTA() {
  let html = "";
  if (state.phase === PHASES.PREDICT) {
    const round = state.currentRound;
    const matchups = computeRoundMatchups(state.picks, round);
    const picked = matchups.filter((m) => state.picks[m.id]).length;
    const remaining = matchups.length - picked;
    if (remaining > 0) {
      html = `<button class="btn btn-primary btn-block" disabled>Pick ${remaining} more</button>`;
    } else if (round !== "FINAL") {
      const next = ROUNDS[ROUNDS.indexOf(round) + 1];
      html = `<button class="btn btn-primary btn-block" data-action="next-round">Continue to ${ROUND_LABELS[next]} →</button>`;
    } else {
      html = `<button class="btn btn-primary btn-block" data-action="go-review">Review picks →</button>`;
    }
  } else if (state.phase === PHASES.REVIEW) {
    html = `<button class="btn btn-primary btn-block" data-action="open-submit">Submit my bracket →</button>`;
  } else if (state.phase === PHASES.SUBMITTING) {
    html = `<button class="btn btn-primary btn-block" disabled>Submitting…</button>`;
  }
  if (html) {
    ctaEl.innerHTML = `<div class="inner">${html}</div>`;
    ctaEl.hidden = false;
  } else {
    ctaEl.hidden = true;
    ctaEl.innerHTML = "";
  }
}

// ---------- actions ----------
function startPicking() {
  const input = document.getElementById("name-input");
  const name = titleCase(input?.value || "");
  if (!name) {
    state.nameError = "Please enter your name.";
    state.nameValue = input?.value || "";
    render();
    return;
  }
  // returning visitor who already submitted under this name -> show their leaderboard
  const existing = state.submissions.find(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    state.name = existing.name;
    state.phase = PHASES.LEADERBOARD;
    render();
    return;
  }
  state.name = name;
  state.nameError = "";
  state.resumeName = "";
  state.phase = PHASES.PREDICT;
  state.currentRound = "R32";
  saveLocalDraft(state);
  render();
}

function pick(matchId, team) {
  state.picks[matchId] = team;
  pruneDownstream(state.picks);
  saveLocalDraft(state);
  render();
}

function gotoRound(round) {
  if (!reachableRounds(state.picks).has(round)) return;
  state.currentRound = round;
  saveLocalDraft(state);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function nextRound() {
  const next = ROUNDS[ROUNDS.indexOf(state.currentRound) + 1];
  if (next) gotoRound(next);
}

function scrollToUnpicked() {
  const matchups = computeRoundMatchups(state.picks, state.currentRound);
  const first = matchups.find((m) => !state.picks[m.id]);
  if (!first) return;
  const cards = app.querySelectorAll(".match-card");
  const idx = matchups.indexOf(first);
  cards[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function openSubmitModal() {
  modalRoot.innerHTML = confirmModalHtml();
}
function closeModal() {
  modalRoot.innerHTML = "";
}

async function doSubmit() {
  closeModal();
  state.phase = PHASES.SUBMITTING;
  render();
  const entry = {
    name: state.name,
    submittedAt: new Date().toISOString(),
    picks: { ...state.picks },
  };
  try {
    const data = await submitWithRetry(entry);
    state.submissions = data.submissions;
    clearLocalDraft();
    state.phase = PHASES.LEADERBOARD;
    state.viewTab = "leaderboard";
    render();
    celebrate();
  } catch (e) {
    if (e.message === "NAME_TAKEN") {
      state.phase = PHASES.NAME_ENTRY;
      state.nameError = `Someone named "${state.name}" already submitted. Add a last initial or use a nickname.`;
      state.nameValue = state.name;
      render();
    } else {
      state.phase = PHASES.REVIEW;
      render();
      alert("Submission failed — please check your connection and try again. Your picks are saved.");
    }
  }
}

function celebrate() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof window.confetti !== "function") return;
  window.confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
}

// ---------- event wiring (delegation) ----------
document.addEventListener("click", (e) => {
  const teamBtn = e.target.closest(".team-row[data-match]");
  if (teamBtn) {
    pick(teamBtn.dataset.match, teamBtn.dataset.team);
    return;
  }
  const roundTab = e.target.closest(".round-tab[data-round]");
  if (roundTab && !roundTab.disabled) {
    gotoRound(roundTab.dataset.round);
    return;
  }
  const lbTab = e.target.closest(".tab[data-tab]");
  if (lbTab) {
    state.viewTab = lbTab.dataset.tab;
    render();
    return;
  }
  const viewPerson = e.target.closest("[data-view-person]");
  if (viewPerson) {
    const name = viewPerson.dataset.viewPerson;
    const idx = state.submissions.findIndex((s) => s.name === name);
    state.viewPerson = idx >= 0 ? idx : 0;
    state.viewTab = "all";
    render();
    return;
  }
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  switch (action) {
    case "start": startPicking(); break;
    case "resume":
      state.phase = PHASES.PREDICT;
      state.currentRound = state.currentRound || "R32";
      render();
      break;
    case "startover":
      clearLocalDraft();
      state.picks = {};
      state.name = "";
      state.resumeName = "";
      state.currentRound = "R32";
      state.phase = PHASES.NAME_ENTRY;
      render();
      break;
    case "view-standings":
      state.phase = PHASES.LEADERBOARD;
      state.viewTab = state.viewTab || "leaderboard";
      render();
      window.scrollTo({ top: 0 });
      break;
    case "go-predict":
      state.phase =
        state.name && Object.keys(state.picks).length > 0
          ? PHASES.PREDICT
          : PHASES.NAME_ENTRY;
      render();
      window.scrollTo({ top: 0 });
      break;
    case "scroll-unpicked": scrollToUnpicked(); break;
    case "next-round": nextRound(); break;
    case "go-review": state.phase = PHASES.REVIEW; render(); window.scrollTo({ top: 0 }); break;
    case "edit-picks":
      state.phase = PHASES.PREDICT;
      state.currentRound = "R32";
      render();
      break;
    case "open-submit": openSubmitModal(); break;
    case "modal-cancel":
      if (e.target.closest(".modal") && !e.target.closest("[data-action='modal-cancel']")) break;
      closeModal();
      break;
    case "modal-confirm": doSubmit(); break;
    case "person-prev":
      state.viewPerson = (state.viewPerson - 1 + state.submissions.length) % state.submissions.length;
      render();
      break;
    case "person-next":
      state.viewPerson = (state.viewPerson + 1) % state.submissions.length;
      render();
      break;
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "person-select") {
    state.viewPerson = Number(e.target.value) || 0;
    render();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "name-input") {
    e.preventDefault();
    startPicking();
  }
  if (e.key === "Escape" && modalRoot.innerHTML) closeModal();
});

// ---------- bootstrap ----------
async function boot() {
  state.demo = isDemo();
  try {
    const [resultsDoc, pred] = await Promise.all([readResults(), readPredictions()]);
    state.results = resultsDoc.results || {};
    state.scores = resultsDoc.scores || {};
    state.resultsMeta = { lastUpdated: resultsDoc.lastUpdated };
    state.submissions = pred.data.submissions || [];
  } catch (err) {
    console.error("Load error:", err);
    state.results = {};
    state.submissions = [];
  }

  const draft = loadLocalDraft();
  if (draft?.name && state.submissions.some((s) => s.name.toLowerCase() === draft.name.toLowerCase())) {
    state.name = draft.name;
    state.phase = PHASES.LEADERBOARD;
  } else if (draft?.picks && Object.keys(draft.picks).length > 0) {
    state.name = draft.name || "";
    state.picks = draft.picks;
    state.currentRound = draft.currentRound || "R32";
    state.resumeName = draft.name || "";
    state.phase = PHASES.NAME_ENTRY;
  } else {
    state.phase = PHASES.NAME_ENTRY;
  }
  render();
}

boot();
