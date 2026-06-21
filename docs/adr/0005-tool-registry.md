# ADR-0005 — In-process `CreationTool` registry as the one extension point

**Status:** Accepted
**Date:** 2026-06-21

## Context
The product requires that creation tools are **not hardcoded one by one**: there
must be exactly one documented interface, and a new tool is added by implementing it
and registering it, **with no changes to the core app**. We currently have only
first-party tools (pixel art first; animation, photo, music, video later). Loading
arbitrary third-party code would be a large security surface for no current benefit.

## Decision
Define a typed **`CreationTool` interface** and an **in-process registry**
(`register/get/list`) in `src/lib/tools/`. Tools are **lazy-loaded first-party
modules**, each in its own folder. The single wiring file `src/lib/tools/index.ts`
holds the only `registerTool(...)` calls. A tool's exported output (`ToolExport`,
raster/audio Blob) flows through the **same server-side upload+validation pipeline**
as any upload (ADR-0007) — tools never write to storage directly. The full contract
is in [ARCHITECTURE.md §7](../../ARCHITECTURE.md#7-the-extensible-tool-system).

## Consequences
- Adding a tool = a new folder + **one line** in the wiring file; core untouched
  (the reviewer/drift-audit verifies this).
- Tools are type-checked against one contract and trivially unit-testable.
- Tools ship in the app bundle (lazy-loaded) — fine while first-party.
- Tool output is untrusted and re-validated server-side — one security choke point
  for all tools; **no SVG output**.

## Alternatives
- **Runtime/remote plugin loading (arbitrary JS)** — large arbitrary-code security
  surface; no third-party authors today; rejected (revisit only if that changes).
- **Microfrontend per tool** — over-engineering for a solo app; violates "simple".
