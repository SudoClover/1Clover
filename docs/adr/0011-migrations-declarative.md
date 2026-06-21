# ADR-0011 — Declarative schema + reviewed migrations, CI-to-prod only

**Status:** Accepted
**Date:** 2026-06-21

## Context
The schema must evolve **only** through version-controlled migrations — no ad-hoc
changes — and the implementing agent must never be able to damage production data
(Autonomy guardrail #1). Auto-generated diffs miss edge cases (views, functions,
policies). Destructive changes are high-risk.

## Decision
The **declarative schema** under `supabase/schemas/` (tables, RLS, functions) is the
source of truth. Generate timestamped migrations with **`supabase db diff`**, **commit
every migration**, and **review every generated diff by hand** before use. Develop
and test against **local `supabase start`**; **`supabase db reset` must rebuild the
whole DB from migrations cleanly**; regenerate types after each migration. Maintain
**separate dev/prod projects**; migrations reach prod **only via GitHub Actions on
merge to `main`** — never `db push` from a laptop, never Dashboard edits (drift). Be
**additive by default and use expand-contract** (add → backfill → remove later)
instead of dropping. A **destructive change, or any schema change touching existing
user data, is a #2 human gate** (plain-language brief + overseer approval + confirmed
backup/PITR) and is applied only via CI.

## Consequences
- Schema history is reproducible and reviewable; local parity catches issues early.
- The agent cannot alter prod schema directly — only the CI path can, on merge.
- Hand-review of diffs catches the cases the tool misses (policies/functions/views).
- Per-environment Dashboard settings (auth config) are documented separately since
  migrations don't capture them.

## Alternatives
- **Ad-hoc Dashboard / `db push` to prod** — causes drift; forbidden.
- **Trusting auto-diffs unreviewed** — misses edge cases; forbidden.
