# Pane Tree P1/P2 Hardening — Edge Cases + Security Fix

**Date**: 2026-04-16 19:00  
**Severity**: High  
**Component**: Terminal pane split tree, IPC, clipboard, persistence, accessibility  
**Status**: Resolved (7 phases shipped to beta)

## What Happened

Executed P1 + P2 items from a 147-finding edge-case audit of the pane-split-tree + themed context menu shipped earlier today. TDD-first approach: failing test → implement → green. Code review caught 2 criticals; both fixed in-session. 674 tests pass (up from 644). 8 commits landed on `beta` spanning timeout hardening, hotkey UX unification, resize-handle interaction safety, paste security, persistence forward-compat, focus restoration, and keyboard accessibility.

## Phases Landed

1. **IPC timeout in `useExecuteSplit`** — `Promise.race` against 10 s window; on timeout fires toast + releases in-flight slot (prevents phantom pane creation on slow main-side response).

2. **Unified at-limit hotkey UX** — `App.onSplit` always passes a handler; gate inside `executeSplit` emits `notifyLimit` uniformly (previously global hotkey silently no-op'd while xterm-focused path toasted, inconsistent affordance).

3. **Resize handle hardening** — `setPointerCapture` + element-scoped listeners replace global `window` pointer handlers; cleanup teardown ref fires on unmount mid-drag; rect re-read in `onMove` tolerates window resize; CSS `::before` expands hit-area to ~7 px with `touch-action: none`; `updateRatio` returns tree unchanged on stale path instead of throwing.

4. **Paste hardening** — CRLF normalization, bracketed-paste wrapping via `term.modes.bracketedPasteMode`, 64 KB chunking with `setTimeout(0)` yields between chunks; sentinel bookends WHOLE payload not per-chunk; threaded xterm instance through `useTerminalClipboard` + `use-terminal-init` for bracket-mode state access.

5. **Persistence safety** — Per-process `migrationDone` Set ensures single-flight migration; `savePaneTree` refuses overwrite of higher `schemaVersion` (forward-compat downgrade guard); `isValidPaneTree` adds depth cap (`MAX_TREE_DEPTH = 32`) to prevent stack overflow from malformed IPC payloads; renderer save-rejections surface via `console.error` with projectId context instead of silent swallowing.

6. **Polish** — Themed context menu captures `document.activeElement` on open, restores on close (keyboard a11y); App closes menu on `activeProjectId` change so stale closures don't fire on defunct terminals; `executeSplit` falls back to `activeTerminalId` with direction preserved + toast when right-click source pane closes between menu open and click.

7. **Accessibility** — `ResizeHandle` gained `role="separator"`, `tabIndex=0`, `aria-orientation`, `aria-valuenow/min/max`; Arrow-key ratio adjustment (5 % / 1 % fine with Shift); absolute `minPanePx = 80` clamps nested-split ratios so xterm can't starve.

## The Brutal Truth

Code review at stages 2 and 3 found 2 criticals that would have shipped. The bracketed-paste sentinel injection is a genuine security hole: a malicious clipboard containing `\x1b[201~` breaks the paste boundary early, letting remaining bytes execute as shell commands. The orphan PTY on timeout is a state-corruption bug: late-arriving `create()` promises leave zombie processes. TDD tests passed because they stubbed timing; adversarial review forced thinking about "what if the promise resolves after timeout?" This stung harder than the earlier ship-blocking gaps because we supposedly learned the lesson that TDD doesn't replace integration thinking. Clearly didn't stick.

The bracketed-paste fix strips inner sentinels from the body before wrapping — straightforward but required auditing all upstream clipboard sources. That audit confidence only came from having the vulnerability explicitly named and from a reviewer willing to say "this is a CVE class."

## Technical Details

**F1 — Orphan PTY on create-timeout:**  
The `create()` promise in main may resolve AFTER the renderer's timeout sentinel fires. Renderer moves on, but main-side PTY stays alive; reconcile auto-appends a phantom pane on next project load. Fix: preserve reference to original promise, attach `.then(t => window.electron.terminal.destroy(t.id)).catch(noop)` so late arrivals clean themselves up.

**F6 — Bracketed-paste sentinel escape injection (SECURITY):**  
A malicious clipboard containing `\x1b[201~` closes the bracketed-paste region early; remaining bytes are interpreted as typed shell commands. Classic paste-injection CVE. Fix: strip inner `\x1b[20[01]~` sentinels from body before wrapping (bracketed mode only, so unwrapped literal escapes in legitimate content don't corrupt).

**Additional review-fix pass:** Focus-trap defense in `themed-context-menu` (skip refocus if prev element lives inside menu portal); DRY helper `fireSave` in `pane-tree-store.ts`.

## Deferred Follow-ups

- Help-modal for keyboard-shortcut discoverability (Cmd+/).
- Check `app.requestSingleInstanceLock` in main — cross-window migration race scoped out but Set is per-process.
- Surface timeout + save-fail events via telemetry (no Sentry/crash-reporter wired currently).
- `write`-to-destroyed-terminal behavior during chunked paste — unverified if main silently drops unknown ids or logs.
- `term.modes` feature-detection logging — graceful if xterm API changes.

## Numbers

- 8 commits on `beta`: `f9bdaee` → `049fbd3` (one per phase + docs).
- 674 tests pass (up from 644; 28 new TDD tests + 2 review-fix tests).
- `npx tsc --noEmit` clean. `npm run lint` shows only 2 pre-existing warnings unrelated to this pass.

## Root Cause Analysis

1. **Timeout race not surfaced in unit tests.** The promise timing is uncontrolled in a test harness; real latency exposes the orphan.

2. **Paste injection invisible without adversarial thinking.** Bracketed-paste is a rarely-used xterm feature; the sentinel-wrapping logic never considered "what if user's clipboard contains the sentinel?" Standard test inputs (ASCII text, emojis, newlines) don't trigger.

3. **Review gates too lenient.** Stage 2 review (self) spotted F1 early but missed F6 entirely. Stage 3 (peer) caught F6. Protocol was "one reader catches criticals" — with only 2 rounds, false negatives slip through.

## Lessons Learned

**Stage 3 adversarial review is now mandatory, not optional.** For IPC, clipboard, persistence, security-sensitive paths, one peer review isn't enough. Make it explicit in the DoD. The bracketed-paste injection is exactly the kind of "doesn't occur in happy-path testing" CVE that ships without a second skeptical reader.

**Timeout + state corruption is worse than timeout + dropped data.** The orphan-PTY bug silently corrupts persistent state; detection only happens on next load in a different context. A timeout that loses data is annoying; a timeout that corrupts recovery is dangerous. Test both: immediate failure and late arrival.

**Clipboard is a trust boundary; treat it like IPC.** User-supplied content (even from the OS clipboard) can be crafted. The sentinel-injection fix is trivial (strip inner markers) but the mental model shift is the real win: sanitize clipboard input, don't just pass it through.

## Next Steps

1. Land fixes to beta; re-run test suite. (Complete — all tests green.)

2. Stage 3 adversarial review now mandatory in pre-release checklist.

3. For future clipboard features: unit-test sentinel-boundary cases explicitly (e.g., payload = "\x1b[201~", payload = "text\x1b[201~text").

4. Document timeout race in `terminal.md` architecture doc as a known hard problem (timing is uncontrollable, always defend with late-arrival cleanup).

## One Takeaway

TDD caught the logic bugs within each module; it spectacularly failed at predicting race conditions and security assumptions. Adversarial stage-3 review for security/state/timing paths is now non-negotiable — the bracketed-paste injection would have shipped without it, and that's the kind of mistake that lives in prod for a year.
