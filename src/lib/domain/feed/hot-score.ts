/**
 * Pure "hot" ranking (ARCHITECTURE.md §4.2 — Slice 5). Reddit-style: a popularity term
 * (log of the score) plus an absolute-time term, so newer posts outrank older ones at
 * equal score. Because the time term is absolute (not "age since now"), the value only
 * needs recomputing when the SCORE changes — never on a timer/cron (no spend).
 *
 * This is the canonical spec; the DB stores `posts.hot_score` from the same formula
 * (see `supabase/schemas/03_posts.sql`) and an integration test asserts they agree, so
 * ranking is pure + tested and can't be silently skewed. Higher = hotter.
 *
 * Until ratings land (Slice 6) every post's score is 0, so `hotScore` reduces to the
 * time term and Hot mirrors New — the stable seam ratings slot into later.
 */

// Seconds of age worth one log10 "rank point". Reddit's value; a tuning knob for Slice 6.
export const HOT_TIME_DIVISOR = 45000;

export function hotScore(score: number, createdAtMs: number): number {
	const popularity = Math.log10(Math.max(score, 1));
	const ageTerm = createdAtMs / 1000 / HOT_TIME_DIVISOR;
	return popularity + ageTerm;
}
