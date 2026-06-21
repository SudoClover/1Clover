# ADR-0012 — Realizing the media pipeline (ADR-0007) under the no-spend constraint

**Status:** Accepted
**Date:** 2026-06-21

## Context
[ADR-0007](0007-media-pipeline.md) pins the production pipeline: presign → R2 →
Cloudflare Queues → consumer Worker → **Cloudflare Images** (re-encode/thumbnail) →
**Workers AI** (classify) → flip `moderation_state`. Slice 2 must prove that whole
vertical **with green CI and no spend** — i.e. without creating the real R2 bucket,
Queue, Images, or Workers AI (those are a 💳/#2 deploy gate, deferred).

Two hard runtime facts force the build/test shape:
1. **`sharp` (libvips) is a native Node addon — it cannot run inside `workerd`** (the
   Workers runtime, which `wrangler dev` and `@cloudflare/vitest-pool-workers` use).
   In prod the consumer Worker re-encodes via the **Cloudflare Images binding**, not
   sharp. Locally/CI there is no Images service, so re-encoding must happen in **Node**.
2. SvelteKit on **`vite dev` runs server code in Node**; only `wrangler`/preview runs
   it in `workerd`. So in dev/E2E the SvelteKit server *can* run sharp; in prod it
   cannot.

## Decision
Build the real pipeline skeleton; isolate the paid/native pieces behind seams so the
same control flow is exercised everywhere and the deferred bits swap in at deploy.

- **`ImageProcessor` seam** (`workers/media-consumer`): `reencode()` + `thumbnail()`.
  - **Node impl (dev + CI):** `sharp` — real re-encode to canonical PNG/WebP, strips
    metadata, generates a thumbnail. Exercises true validation + transform on real bytes.
  - **Prod impl (deferred):** Cloudflare Images binding. Wired at the deploy gate; the
    pipeline and tests do not change.
- **Dispatch seam** (`src/lib/server/media/dispatch.ts`): if a Queue binding is present
  (prod) → **enqueue** (async consumer Worker). If not (dev/E2E, Node) → **process
  inline** in-process with the Node `ImageProcessor`. Same pipeline function both ways.
- **Classifier = stub** returning `clean` (auto-approve in dev). Real Workers AI lands
  in Slice 8. Output is a routing signal, never a verdict (ARCHITECTURE §5/§9).
- **Upload transport:** Slice 2 uploads via a single `POST /api/upload` (the file
  passes through the endpoint to `store.put`, bounded by the 10 MiB cap — well within
  Worker body limits). The **presigned-R2-PUT** optimization of ADR-0007 (client → R2
  directly, bytes off the request Worker) is **deferred to the deploy gate**: it needs a
  real bucket to validate (miniflare exposes no S3 endpoint to presign against), and
  shipping unvalidated SigV4 signing now would be untestable security code. The endpoint
  flow is uniform across dev and prod-test and swaps to presign at deploy without
  changing the pipeline.
- **Media-row writes** (insert + state flip) use a **server-side service-role client**
  (`SUPABASE_SECRET_KEY`), never a client role. Clients have **no** insert/update/delete
  privilege on `media` (RLS + column grants), so `owner_id`/`moderation_state` cannot be
  forged from the browser. `owner_id` is pinned to the `getClaims()` subject.

### Test coverage that results
| Layer | Runtime | Proves |
|---|---|---|
| `upload-policy` unit | Node | magic-byte sniff, SVG ban, allowlist, declared/actual mismatch, size/pixel caps |
| consumer pipeline integration | Node + **local Supabase** + real `sharp` + fake R2 | good image → approved/ready; bad file (SVG/wrong magic/oversized) → failed, never served |
| consumer Worker | **workerd** (`vitest-pool-workers`) + real R2 **+ Queue bindings** | queue glue: message → R2 read → safe copy + thumb written to R2 → state-flip called (stub processor + fake DB) |
| board + upload UI E2E | Playwright vs `vite dev` (Node, inline dispatch) | upload → processing → card appears |

## Consequences
- The full async **Queue** path is real but exercised by the pool-workers test with a
  stub processor; the real **re-encode** is exercised by the Node sharp test. Together
  they cover the spine honestly without spend.
- **Dev/prod divergence is explicit and bounded:** dev processes inline in Node (sharp);
  prod enqueues to the Worker (Images). Both call the *same* pipeline function; the only
  swap is the `ImageProcessor` and dispatch mode. Reviewer should check the seam, not be
  surprised by it.
- Deferred to the deploy gate (💳/#2 brief): create R2 bucket + Queue, enable Cloudflare
  Images + Workers AI, wire the prod `ImageProcessor`, add **presigned R2 PUT** (client →
  R2 directly), and verify the real client→R2→Queue round trip. The prod re-encoder
  choice (Cloudflare Images vs an in-worker WASM codec) stays open behind
  `ImageProcessor` — recorded in ASSUMPTIONS.

## Alternatives
- **In-worker WASM codec (jSquash/photon) for re-encode everywhere** — true dev/prod
  parity and no Images dependency, but heavier WASM deps and CPU-in-worker; deferred as
  an option behind the `ImageProcessor` seam, not adopted now.
- **Run the real consumer Worker in dev via `wrangler dev`** — impossible with sharp
  (no native addons in workerd) and needless infra for a spine.
- **Insert the `media` row with the user's RLS-scoped client** — would require granting
  `authenticated` INSERT on `media`, widening the surface; rejected in favour of
  server-side service-role writes with `owner_id` pinned to the verified claim.
