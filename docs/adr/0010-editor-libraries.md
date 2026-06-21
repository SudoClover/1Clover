# ADR-0010 — Per-tool canvas libraries behind the registry

**Status:** Accepted
**Date:** 2026-06-21

## Context
The in-browser editors differ enough that no single canvas library fits all (pixel
grid vs. animation timeline vs. layered photo editing). The unifying force is the
**tool-registry interface** (ADR-0005), not a shared library. The overseer chose the
**pixel-art editor first**.

## Decision
Choose the **right-sized library per tool**, each behind the `CreationTool`
interface:
- **Pixel art (first):** a **lightweight custom `<canvas>`** — pixel editing (grid,
  palette, draw, PNG export) is small and well-understood; a dependency adds weight
  without simplifying, and a tiny first tool keeps the registry contract honest.
- **Frame animation (later):** custom canvas + **gif.js** for GIF export.
- **Photo editing (later):** **Konva** (preferred over Fabric.js — leaner, better
  maintained for layered raster work).

Every tool exports **raster/audio bytes** (`ToolExport`) that flow through the
**same server-side upload+validation pipeline** (ADR-0007). **No SVG output.**

## Consequences
- The first tool stays minimal and proves the contract with the least code.
- Each later tool brings only the library it needs.
- All tool output is re-validated server-side — one safety choke point.

## Alternatives
- **One canvas library for everything (Fabric/Konva for pixel art too)** —
  over-weight and awkward for pixel-grid editing.
- **A heavyweight image-editor SDK** — more abstraction + cost than needed.
