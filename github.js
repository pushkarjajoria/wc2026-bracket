// Data access layer.
//
// predictions.json lives in a dedicated DATA repo and is written via the GitHub
// Contents API using a fine-grained PAT scoped to that repo only. The PAT is
// injected at deploy time into window.APP_CONFIG (see config.js / the workflow).
//
// results.json is a plain static asset shipped with THIS app and is read with a
// relative fetch — no token, no API.
//
// When APP_CONFIG is absent (e.g. local dev), the module runs in DEMO mode:
// predictions are read from a local file and submissions are kept in memory only.

const cfg = () => (typeof window !== "undefined" ? window.APP_CONFIG : undefined);

export const isDemo = () => !cfg() || !cfg().pat;

const dataApiUrl = () => {
  const c = cfg();
  return `https://api.github.com/repos/${c.owner}/${c.dataRepo}/contents/${c.predictionsPath || "predictions.json"}`;
};

const headers = () => ({
  Authorization: `token ${cfg().pat}`,
  Accept: "application/vnd.github+json",
});

const EMPTY = { version: 1, submissions: [] };

// In-memory store for DEMO mode so the submit/leaderboard flow is testable offline.
let demoStore = null;

function decodeContent(content) {
  const clean = (content || "").replace(/\n/g, "");
  const json = decodeURIComponent(escape(atob(clean)));
  return JSON.parse(json);
}

function encodeContent(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))));
}

export async function readPredictions() {
  if (isDemo()) {
    if (demoStore) return { data: demoStore, sha: "demo" };
    try {
      const res = await fetch("./data/predictions.demo.json", { cache: "no-store" });
      demoStore = res.ok ? await res.json() : structuredClone(EMPTY);
    } catch {
      demoStore = structuredClone(EMPTY);
    }
    return { data: demoStore, sha: "demo" };
  }

  const res = await fetch(dataApiUrl(), { headers: headers(), cache: "no-store" });
  if (res.status === 404) return { data: structuredClone(EMPTY), sha: null };
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);
  const { content, sha } = await res.json();
  return { data: decodeContent(content), sha };
}

export async function writePredictions(data, sha) {
  if (isDemo()) {
    demoStore = data;
    return;
  }
  const name = data.submissions.at(-1)?.name ?? "unknown";
  const body = JSON.stringify({
    message: `Add prediction: ${name}`,
    content: encodeContent(data),
    ...(sha ? { sha } : {}),
  });
  const res = await fetch(dataApiUrl(), { method: "PUT", headers: headers(), body });
  if (!res.ok) throw new Error(`Write failed: ${res.status}`);
}

export async function readResults() {
  try {
    const res = await fetch("./data/results.json", { cache: "no-store" });
    if (!res.ok) return { version: 1, lastUpdated: null, results: {} };
    return await res.json();
  } catch {
    return { version: 1, lastUpdated: null, results: {} };
  }
}

export async function submitWithRetry(newEntry, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const { data, sha } = await readPredictions();
    if (
      data.submissions.some(
        (s) => s.name.toLowerCase() === newEntry.name.toLowerCase()
      )
    ) {
      throw new Error("NAME_TAKEN");
    }
    data.submissions.push(newEntry);
    try {
      await writePredictions(data, sha);
      return data;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
    }
  }
}
