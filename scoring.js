// Scoring: later rounds are worth more. Max possible = 64 pts.
export const POINTS = { R32: 1, R16: 2, QF: 4, SF: 8, FINAL: 16 };

export function roundFor(matchId) {
  if (matchId.startsWith("R32")) return "R32";
  if (matchId.startsWith("R16")) return "R16";
  if (matchId.startsWith("QF")) return "QF";
  if (matchId.startsWith("SF")) return "SF";
  if (matchId === "FINAL") return "FINAL";
  return null;
}

// results: { matchId: winningTeam }. Only completed matches are present.
export function calculateScore(picks, results) {
  let score = 0;
  let correct = 0;
  let played = 0;
  for (const [matchId, winner] of Object.entries(results || {})) {
    if (!winner) continue;
    played++;
    if (picks && picks[matchId] === winner) {
      score += POINTS[roundFor(matchId)] || 0;
      correct++;
    }
  }
  return { score, correct, played };
}

export function rankSubmissions(submissions, results) {
  return (submissions || [])
    .map((s) => ({ ...s, ...calculateScore(s.picks, results) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.submittedAt || "").localeCompare(b.submittedAt || "")
    );
}
