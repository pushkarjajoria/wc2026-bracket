// Copy this to config.js for local development. In production, GitHub Actions
// generates config.js from repo secrets on every deploy (see .github/workflows/deploy.yml).
//
// For local dev you can leave `pat` empty to run in DEMO mode (no network writes;
// predictions are read from ./data/predictions.json and submissions stay in memory).
window.APP_CONFIG = {
  owner: "",            // your GitHub username, e.g. "pushkarjajoria"
  dataRepo: "",         // the data-only repo, e.g. "wc2026-bracket-data"
  predictionsPath: "predictions.json",
  pat: "",              // fine-grained PAT with contents:write on the data repo ONLY
};
