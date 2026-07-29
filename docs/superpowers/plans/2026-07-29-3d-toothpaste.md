# 3D Toothpaste Asset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the branded toothpaste image with a child-friendly 3D toothpaste model without changing game behavior.

**Architecture:** Generate one chroma-key raster asset, remove the background to obtain an RGBA PNG, and replace the existing project asset after preserving a rollback copy. Update only the image cache query in `index.html`.

**Tech Stack:** PNG, HTML, CSS, vanilla JavaScript, GitHub Pages.

## Global Constraints

- Do not change the child-facing layout.
- Do not change the 21-step logic.
- Do not introduce dependencies or frameworks.
- Keep the single-file application architecture.

---

### Task 1: Generate and integrate the 3D toothpaste asset

**Files:**
- Create: `toothpaste-original.png`
- Modify: `toothpaste.png`
- Modify: `index.html`
- Modify: `dev-logs/2026-07-29.md`

**Interfaces:**
- Consumes: Existing `<img src="toothpaste.png">` references.
- Produces: An 800×752-compatible RGBA toothpaste asset at `toothpaste.png`.

- [ ] Generate a white, blue-capped, text-free 3D toothpaste tube on a flat chroma-key background.
- [ ] Remove the chroma key and verify transparent corners and subject coverage.
- [ ] Preserve the previous asset as `toothpaste-original.png`.
- [ ] Install the new asset as `toothpaste.png`.
- [ ] Increment the two `toothpaste.png` cache query values in `index.html`.
- [ ] Start a local HTTP server and verify the page returns HTTP 200.
- [ ] Inspect the brushing step 2 rendering and confirm no game logic changed.
- [ ] Record the change and verification result in the daily development log.
- [ ] Commit and push the scoped files to `main`.
