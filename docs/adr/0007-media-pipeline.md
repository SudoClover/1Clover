# ADR-0007 — Async media pipeline (presign → Queues → consumer)

**Status:** Accepted
**Date:** 2026-06-21

## Context
Every upload is hostile until proven otherwise. The same pipeline must enforce
**validation** (magic bytes, caps, re-encode), **Trust & Safety** (classification,
gating), and **processing** (thumbnails/transcodes). Transcoding hostile input
inline in the request Worker is unacceptable (CPU/time limits; a malicious file
shouldn't run in the request path). The overseer chose to **buy managed**
processing.

## Decision
A **single async pipeline**: the SvelteKit endpoint (auth-gated, rate-limited)
issues a **presigned R2 PUT** with a **server-generated key** and inserts a `media`
row as `pending`; the client PUTs bytes to R2; the endpoint **enqueues a Cloudflare
Queues** job; a **consumer Worker** (`workers/media-consumer`) validates (magic
bytes vs strict allowlist, reject polyglots/SVG, enforce size/dimension/duration
caps), **re-encodes to a canonical safe format** (strips EXIF, neutralizes
payloads) producing thumbnails/variants via **Cloudflare Images / Media
Transformations**, runs a **Workers AI safety classification** (routing signal, not
a verdict), then flips `moderation_state` to `approved` (clean) or `held`
(suspect). Only the safe re-encoded copy is served, via signed URLs. Cloudflare's
**CSAM Scanning Tool** runs on the media zone. Video (Stream) and audio are added
only when those media types reach the roadmap. Full flow: [ARCHITECTURE §5](../../ARCHITECTURE.md#5-upload--processing-pipeline).

## Consequences
- Heavy/hostile work is off the request path; ret/retry + dead-letter via Queues.
- Content is `pending` (invisible) until it passes; classifier only routes to a
  human, never auto-publishes/condemns.
- Originals are never served; EXIF/payloads neutralized; SVG banned.
- Creation-tool output reuses this exact pipeline (ADR-0005) — one safety choke
  point.
- Buying managed transforms means less code but vendor coupling + possible global
  caching of derived media (accepted per EU-residency call).

## Alternatives
- **Transcode inline in the request Worker** — disallowed (limits + security).
- **Self-run ffmpeg infrastructure** — significant code/ops risk for a solo build.
