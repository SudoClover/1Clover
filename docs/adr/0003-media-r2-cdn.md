# ADR-0003 — Cloudflare R2 + CDN for media; DB stores references only

**Status:** Accepted
**Date:** 2026-06-21

## Context
This is a media-heavy board (images now; audio/video later). The principle "media
as references" forbids storing bytes in the primary database. The dominant cost risk
for media platforms is **egress bandwidth**. We also want the media, the edge
validation, and the CDN on the same platform as the frontend (ADR-0001).

## Decision
Store objects in **Cloudflare R2** (S3-compatible, **zero egress**) behind
**Cloudflare's CDN**, served via **signed URLs** as non-executable static assets.
The Postgres database stores only the R2 object key + metadata, never blobs. Enable
**R2 object versioning** on the prod bucket as the media-backup posture (DB backups
do not cover media). Keep originals in R2 with EU jurisdiction where configurable;
managed transforms may cache globally (overseer's pragmatic EU-residency call).

## Consequences
- Media bandwidth is not a budget driver (zero egress) — the reason this scales
  cheaply.
- One platform/bill for frontend + media + CDN + edge; no cross-vendor egress
  surprise.
- Media backup is **separate** from DB backup and must be designed explicitly
  (versioning + periodic copy) — a known trap, handled in Slice 13.
- R2 is newer than S3 with fewer third-party integrations — acceptable.

## Alternatives
- **AWS S3 + CloudFront** — mature but egress-billed (dominant cost for media) and
  cross-vendor with the frontend.
- **Supabase Storage** — in-stack but S3 egress economics; we keep large-object
  bandwidth on the zero-egress provider.
