// Local draft persistence + small helpers. The live app state lives in app.js.

const KEY = "wc2026_draft";

export const PHASES = {
  LOADING: "LOADING",
  NAME_ENTRY: "NAME_ENTRY",
  PREDICT: "PREDICT",
  REVIEW: "REVIEW",
  SUBMITTING: "SUBMITTING",
  SUBMITTED: "SUBMITTED",
  LEADERBOARD: "LEADERBOARD",
};

export function saveLocalDraft(s) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ name: s.name, picks: s.picks, currentRound: s.currentRound })
    );
  } catch {
    /* storage may be unavailable (private mode) — non-fatal */
  }
}

export function loadLocalDraft() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearLocalDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}

// "  jOHN   o'BRien " -> "John O'Brien"
export function titleCase(raw) {
  return (raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}
