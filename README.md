# World Cup 2026 — Bracket Predictor

A static, no-backend site where friends and family pick winners for every 2026 FIFA
World Cup knockout match (Round of 32 → Final), submit once, and watch a live
leaderboard as results come in.

- **App repo** (this one): all the static site code + `data/results.json` (real winners) + the results CLI.
- **Data repo** (separate, e.g. `wc2026-bracket-data`): holds `predictions.json` (everyone's picks).

Why two repos? User submissions are written from the browser using a GitHub token.
That token is scoped to **only the data repo**, so even if someone extracts it from the
page, the worst they can do is edit bracket predictions — they can't touch this app's
code or any other repository.

---

## How it works

| File | Lives in | Written by | Read by the app via |
|---|---|---|---|
| `predictions.json` | data repo | the browser (GitHub Contents API + scoped PAT) | GitHub API |
| `data/results.json` | this repo | you, via `update-results.mjs` (a normal git commit) | relative `fetch` |

`results.json` never needs the token. Updating results is just a commit to this repo,
which triggers a redeploy.

---

## One-time setup

1. **Create two repos** on GitHub (no README/license needed so the first push is clean):
   - `wc2026-bracket` (this app)
   - `wc2026-bracket-data` (the data)

2. **Push the data repo** (see its own README). Make sure `predictions.json` exists at its root.

3. **Create a fine-grained Personal Access Token**
   (GitHub → Settings → Developer settings → Fine-grained tokens):
   - **Repository access:** Only select repositories → `wc2026-bracket-data`
   - **Permissions:** Repository permissions → **Contents: Read and write**
   - Copy the token.

4. **Add secrets to THIS repo** (Settings → Secrets and variables → Actions → New secret):

   | Secret | Value |
   |---|---|
   | `GH_OWNER` | your GitHub username, e.g. `pushkarjajoria` |
   | `GH_DATA_REPO` | `wc2026-bracket-data` |
   | `GH_PAT` | the fine-grained token from step 3 |

5. **Enable Pages:** Settings → Pages → **Source: GitHub Actions**.

6. **Push this repo to `main`.** The workflow injects `config.js` from the secrets and
   deploys. Your site goes live at `https://<owner>.github.io/wc2026-bracket/`.

---

## Updating results (your day-to-day job)

After each match day, from a local clone of **this** repo:

```bash
# See every match, its fixture, and current status
node update-results.mjs --list

# Set winners (commits + pushes; Pages redeploys in ~60s)
node update-results.mjs R32_M9=Brazil R32_M1=Germany -m "Jun 29 results"

# Fix a mistake — clear a result, then re-set it
node update-results.mjs R32_M9=
node update-results.mjs R32_M9=Japan

# Preview without writing
node update-results.mjs R32_M9=Brazil --dry-run
```

- Team names are case-insensitive and accept aliases (`usa`, `drc`, `bosnia`, `cote d'ivoire`, …).
- You can only set a later-round winner once the earlier results that produce its two
  teams are entered (the tool checks this for you).
- The leaderboard recalculates on each page load — there is no cache to clear.

Prefer not to use the CLI? You can also edit `data/results.json` directly on GitHub.com
and commit; same effect. Or ask Cursor: *"Brazil beat Japan, Germany beat Paraguay — update results.json"*.

---

## Local development

```bash
cp config.example.js config.js   # leave pat empty for DEMO mode
node dev/serve.mjs                # http://localhost:8099
```

In DEMO mode submissions stay in memory and the leaderboard reads `data/predictions.demo.json`,
so you can click through the whole flow without a token.

Run the logic + render tests:

```bash
node tests/logic.test.mjs
node tests/render.smoke.mjs
```

---

## Scoring

| Round | Points per correct pick |
|---|---|
| Round of 32 | 1 |
| Round of 16 | 2 |
| Quarter-Final | 4 |
| Semi-Final | 8 |
| Final | 16 |

Max possible: **64 points**.

The bracket data in `data/bracket.js` is verified against the official FIFA 2026
knockout schedule; matches are ordered so the single-elimination tree is reproduced exactly.
