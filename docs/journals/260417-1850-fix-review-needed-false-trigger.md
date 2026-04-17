# Fix Review-Needed False-Trigger on Terminal Resize / Redraw

**Date:** 2026-04-17
**Plan:** `plans/20260417-1850-fix-review-needed-false-trigger/`
**Status:** DONE — 858/858 tests pass, typecheck + lint clean, code-reviewer concerns resolved

## What changed

Stopped the "Review Needed" notification from firing repeatedly every time the
user resized or zoomed a terminal while a Claude approval prompt was on screen.
Root cause: SIGWINCH → Claude TUI redraw → `[Y/n]` re-emitted → `REVIEW_PATTERN`
matched again; the old 5s time-only debounce did not dedupe by content, and the
regex was loose enough to match unrelated shell output.

## Layered defense landed

1. **Layer 2a — tightened `REVIEW_PROMPT_PATTERN`** (`shared/constants/notification.ts`)
   Dropped loose alternates (`approve` bare, `waiting for input|response|confirmation`,
   `allow this tool`). Added structured `Do you want to (proceed|continue|approve) ... ?`
   and word-bound `Allow <tool> to run|execute`. Parser + legacy `ENHANCED_DETECTION_PATTERNS`
   both reference the same regex literal — single source of truth, no drift risk.
2. **Layer 2b — per-terminal content-hash dedup** (`plain-text-parser.ts`)
   SHA-1 over `${taskName}|${firstMatchingLine}`, 16-char hex digest, 60s TTL.
   `firstMatchingLine()` prefers the `Allow <tool> to run|execute` line when
   present, so a redraw that reorders `[Y/n]` vs body (common when ANSI cursor
   positioning rewrites rows out of render order) still hashes identically.
   Replaces the old `${terminalId}:reviewNeeded` time-only debounce entirely.
   `clearTerminal()` + `cleanup()` both clean the hash map.
3. **Layer 3 — audit + JSONL immunity doc**
   `claude-log-watcher.ts` header documents that JSONL is file-appended and
   structurally immune to PTY redraw. Runtime-toggle test for `mobileControlEnabled`
   guards the Layer 1 hard gate against future refactors forgetting one of the
   three mutation sites.
4. **Layer 1 UX nudge** (`notification-settings.tsx`)
   Hint banner below the "On Review Needed" toggle when mobile control is OFF,
   linking users to the Mobile tab for the precise hook-based detection path.
   Banner disappears when either mobile control comes online or Review Needed
   is disabled. `role="status"` for accessibility.

## Tests

| Suite | Count | Notes |
|---|---|---|
| `output-parser.spec.ts` | 49 (was 37) | 13 new: redraw dedup, reverse-order redraw, fixture dedup, distinct-prompt pass-through, TTL expiry, tightened-pattern negative + positive cases, terminal isolation, clearTerminal cleanup |
| `notification-manager.spec.ts` | 2 | new: `mobileControlEnabled` runtime enable→disable→re-enable suppression contract |
| `notification-settings.spec.tsx` | 5 (new file) | banner visibility under each flag combination + click-navigation |

Phase 01 was pure TDD — 10 tests written + failing before any production code
moved. Phase 02 implementation turned them all green without touching the new
assertions.

## Decisions & deviations

1. **Time-debounce eliminated on reviewNeeded path.** Plan said "keep existing
   debounceMs=5000 as a safety net" but the hash-keyed TTL subsumes it; keeping
   both would silently block legitimate distinct approvals within 5s. Time
   debounce retained only on the non-Claude `buildTaskEvent` path
   (taskComplete/taskFailed for codex/gemini/aider), which is untouched.
2. **Synthetic fixture, not captured.** Live Claude session capture was not
   reachable in this cycle. Fixture file includes `# SYNTHETIC` marker and the
   loader converts literal `\x1b` sequences to actual ESC bytes at read time.
3. **Phase 05 deferred.** Resize-aware suppression (terminal-manager `resize`
   event + per-terminal cooldown window) was gated on phase-02 being
   insufficient. Unit tests pass cleanly; defer until field evidence of
   multi-chunk redraw edge cases defeating hash dedup. Plan marked `deferred`.
4. **`[y/N]` asymmetric-bracket prompts NOT widened.** Code reviewer flagged
   this — third-party CLI wrappers under codex/gemini may use lowercase-y +
   capital-N destructive defaults. Accepted as a known scope miss; widen the
   pattern in a follow-up if telemetry shows third-party wrappers are
   under-covered.
5. **Existing loose-pattern test updated.** One pre-existing test asserted
   `'waiting for your confirmation'` fired — semantically incompatible with the
   new tightened pattern. Replaced with `Do you want to proceed?`. Two
   context-extraction tests used `Allow`tool`to execute` as "neutral context"
   which now matches the new pattern directly; switched to genuinely neutral
   phrases (`Running npm install ...`) to preserve test intent.

## Post-review fixes

Code-reviewer flagged a latent hash-stability bug: `firstMatchingLine()` as
originally implemented returned the FIRST line matching `REVIEW_PATTERN`, which
in a reverse-order redraw (row 3 written first via `\x1b[3;1H`) would be `[Y/n]`
in chunk 1 but `Allow bash to run ...` in chunk 2 → different hashes → duplicate
fire. Fix: prefer `TOOL_APPROVAL_PATTERN` match over first-match for the hash
input. Added regression test covering the reverse-order scenario. Also retired
the duplicate regex literal in shared/constants by importing the canonical
`REVIEW_PROMPT_PATTERN` in both sites.

## Files touched

- `src/main/notification/plain-text-parser.ts`
- `src/shared/constants/notification.ts`
- `src/main/notification/claude-log-watcher.ts` (header comment)
- `src/main/notification/__tests__/output-parser.spec.ts`
- `src/main/notification/__tests__/notification-manager.spec.ts`
- `src/renderer/components/settings/notification-settings.tsx`
- `src/renderer/components/settings/notification-settings.spec.tsx` (new)
- `src/renderer/components/settings/settings-panel.tsx`
- `plans/20260417-1850-fix-review-needed-false-trigger/fixtures/redraw-sample.txt` (new)

## Unresolved questions

- Does Claude emit reverse-order redraws in the wild? Fix is now robust against
  it, but confirming empirically would let us either trust or retire the extra
  preference logic.
- Are codex/gemini/aider approval prompts in scope for the plain-text emission
  path, or is that path effectively claude-only in practice? Decision gates
  whether to widen `[y/N]` bracket casing.
- Phase 05 (resize-cooldown) — still warranted as belt-and-suspenders if
  post-deployment QA ever shows a false trigger the hash dedup missed?
