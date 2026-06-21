# ADR-0008 — Supabase Auth; authorize via `getClaims()`, never `getSession()`

**Status:** Accepted
**Date:** 2026-06-21

## Context
Auth is the foundation of access control on a UGC platform and is a #2 human-gate
area. The common, dangerous mistake is authorizing on `getSession()`, which returns
**unverified** (spoofable) data. We must never hand-roll auth or sign user JWTs. We
run on Cloudflare Workers + Supabase with cookie-based SSR.

## Decision
Use **Supabase Auth** via `@supabase/ssr` (cookie-based, **PKCE**), with
**asymmetric JWT signing keys** and the new rotatable **`sb_publishable_` /
`sb_secret_`** API keys (one secret key per backend component; never the legacy
10-year JWT keys). **Authorize every protected route/resource with `getClaims()`**
(or `getUser()` when a fresh record is needed) — **never `getSession()`**.
Initialize the Supabase client **per request** (never at module scope); **never
cache** authenticated routes or any response that sets/refreshes the session cookie.
At launch: email/password with verification + reset; OAuth/MFA deferred behind a
clean seam (config only, no schema change).

## Consequences
- Authorization is based on verified claims, closing the `getSession()` spoofing
  hole.
- Per-request client + no-cache rules are mandatory on the CDN (cache poisoning /
  session leakage otherwise).
- The **secret key bypasses RLS** → server-only; its exposure is a full breach.
- GDPR erasure relies on `auth.users(id) ON DELETE CASCADE` across user tables (+
  explicit R2 purge) — see Slice 9.

## Alternatives
- **Auth.js / hand-rolled JWTs** — re-implements a security-critical system; rejected.
- **Authorizing on `getSession()`** — unverified/spoofable; forbidden.
