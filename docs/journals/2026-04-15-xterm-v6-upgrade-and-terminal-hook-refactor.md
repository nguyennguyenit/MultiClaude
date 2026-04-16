# xterm.js v6 Upgrade + Terminal Hook Refactor: The Big Untangle

**Date**: 2026-04-15 00:00
**Severity**: High
**Component**: Terminal Infrastructure (`use-terminal.ts`, scroll machine, sub-hooks)
**Status**: Resolved

## What Happened

A 6-phase plan executed across a single session: upgraded `@xterm/xterm` 5.5.0 → 6.0.0, stripped all deprecated API surface, rewrote the scroll state model as a pure class, and split a 1454-line god hook into 9 focused sub-hooks plus an orchestrator. End state: 0 typecheck errors, 0 lint warnings, 456 tests passing (48 files), commit `aa8e1ed` on `beta`.

## The Brutal Truth

`use-terminal.ts` was 1454 lines of interdependent scroll refs and conditional side-effects that nobody dared touch. Scroll state alone used **8 separate `useRef` calls** (`pendingWriteCount`, `isAtBottom`, `isWriting`, `hiddenViewportIntent`, `pendingUserScrollIntent`, `followOutputOnNextWrite`, `pendingWriteSnapshot`, `savedViewportY`) scattered through the file with no single mental model to hold them together. This was not technical debt — it was a load-bearing wall made of spaghetti. Every bug fix in the past six months was a gamble that you hadn't accidentally moved one of those refs out of sync.

The xterm v6 upgrade was the forcing function. The deprecated `windowsMode` and `fastScrollModifier` options were warnings that had already been ignored for months. The real motivation was v6's bug fixes for macOS IME duplicates, CapsLock double-fire, and scroll teleport — all active user pain.

## Technical Details

**xterm.js v6 breaking changes handled:**
- Removed `windowsMode` (deprecated option) — deleted from terminal constructor
- Removed `fastScrollModifier` (deprecated option) — deleted from terminal constructor
- Alt-arrow key sequences removed from v6 built-ins — manually re-added in `useTerminalKeyboard`
- Viewport DOM layout changed in v6; audited all DOM scroll listeners for compatibility

**v6 bug fixes that motivated the upgrade:**
- `#5024`: macOS IME composing inserts duplicate characters
- `#5282`: CapsLock fires keydown twice
- `#5390`, `#5411`: Scroll position teleports on rapid output
- `#5328`: Viewport not refreshing after hide/show

**New `TerminalScrollMachine` class** (`src/renderer/utils/terminal-scroll-machine.ts`):
```typescript
// Before: 8 scattered refs in use-terminal.ts
const pendingWriteCountRef = useRef(0)
const isAtBottomRef = useRef(true)
const isWritingRef = useRef(false)
// ... 5 more ...

// After: single ref to a pure class
const scrollMachineRef = useRef(new TerminalScrollMachine())
```

The class is pure — zero React, zero xterm imports. Testable in Node without a DOM.

**`use-terminal.ts` line count: 1454 → 199**

Sub-hooks extracted:
| Hook | Lines | Responsibility |
|------|-------|---------------|
| `useTerminalInit` | 366 | terminal + addon construction, lifecycle |
| `useTerminalClipboard` | 226 | copy/paste, OSC52 handling |
| `useTerminalScroll` | 237 | scroll machine integration, follow-output logic |
| `useTerminalWebGL` | 251 | WebGL renderer, canvas lifecycle |
| `useTerminalFontTheme` | 142 | font/theme reactive updates |
| `useTerminalVisibility` | 138 | tab visibility, focus/blur |
| `useTerminalFit` | 131 | ResizeObserver, fit addon |
| `useTerminalKeyboard` | 82 | key bindings, alt-arrow re-injection |
| `useTerminalDebug` | 84 | debug panel, perf metrics |

**Key v6 API additions used:**
- `reflowCursorLine: true` in terminal constructor
- `terminal.onWriteParsed` — fires post-parse, pre-render; used to snapshot buffer state for accurate scroll tracking after xterm has processed the write but before it repaints

**OSC52 unresolved:** `onData` is user input, not shell output — cannot use it to intercept OSC52 clipboard sequences from the shell. Noted as unresolved in the plan, punted to future work.

## What We Tried

1. **TDD first, extract second** — wrote 59 characterization tests against the existing scroll behavior before touching `use-terminal.ts`. This was the right call. Without those tests, refactoring 8 interdependent refs would have been flying blind. Cost: ~40% of total session time. Worth every minute.

2. **`environmentMatchGlobs` in vitest config** — renderer hook tests need jsdom, Node utils need node environment. Configuring per-file env matching via `environmentMatchGlobs` was the right solution, but required careful glob ordering (more specific patterns first). First attempt had wrong glob precedence and wrong tests ran in wrong environment.

3. **Sub-hooks: no cross-imports constraint** — enforced explicitly that sub-hooks do NOT import each other. All inter-hook wiring goes through `use-terminal.ts` (the orchestrator). This constraint looks rigid but it's the only way to prevent the same dependency tangle from re-emerging in 6 months. It forces shared state into `SharedTerminalRefs` in `terminal-hook-types.ts`.

4. **`onWriteParsed` for scroll snapshot timing** — xterm v5 had no post-parse hook. We were using `onData` + `setTimeout(0)` to estimate when a write was "done" and the buffer state was stable for scroll decisions. v6's `onWriteParsed` fires synchronously after the parser processes each write chunk, so scroll snapshots now reflect actual buffer state. The old setTimeout hack is gone.

## Root Cause Analysis

**Why was `use-terminal.ts` 1454 lines?**

Feature accretion over ~18 months with no architectural intervention. Each new terminal capability (WebGL, fit, clipboard, debug) was added as additional `useEffect`/`useCallback`/`useRef` blocks directly in the file. Nobody ever paid the extraction tax because there was always something more urgent. The scroll machine was the worst because scroll behavior is deeply stateful — every new edge case (user scroll intent, hidden viewport, rapid write sequences) added another ref and another conditional check against the others.

**Why didn't anyone catch it earlier?**

The file worked. No production crashes, no systematic test failures. The cost was entirely in developer velocity and fear-of-touch. That kind of debt is invisible until it's catastrophic.

## Lessons Learned

1. **Model your state before writing React.** The scroll machine should have been a plain class from the beginning. Eight separate `useRef` calls for a single behavioral state machine is a code smell that should have been caught in review. If you're reaching for more than 3 refs to model one behavior, extract a state machine.

2. **Characterization tests before any refactor.** Do not touch a 1454-line file without a test harness that pins the existing behavior. Write the tests against the ugly code first. Then refactor. Then verify nothing broke. This is non-negotiable for systems with subtle timing behavior (scroll, animation, input events).

3. **Post-parse hooks change everything for output-driven UI.** `onWriteParsed` is the right hook for anything that needs to react to terminal output — not `onData` (that's input), not `setTimeout(0)` (that's a lie). If you're maintaining a scroll machine or any output-reactive state, ensure you're firing state updates from `onWriteParsed`.

4. **Sub-hook no-cross-import rule must be enforced structurally.** Document it in `terminal-hook-types.ts` header, enforce it in code review, add a lint rule if needed. The moment sub-hooks start importing each other, the tangled single-file complexity just becomes tangled multi-file complexity. The orchestrator exists for a reason.

5. **`environmentMatchGlobs` in vitest is order-sensitive.** More specific globs must appear before less specific ones. Put `**/__mocks__/**` and `**/renderer/**` before `**/*.ts`. First attempt had this backwards and 30 tests ran in the wrong environment with cryptic failures.

## Next Steps

- **OSC52 clipboard from shell output** — `onData` is the wrong hook; needs investigation of `onBinary` or a custom parser sequence. Unowned, no timeline. File issue.
- **`useTerminalInit` at 366 lines** — still over the 200-line guideline. Candidate for a second extraction pass (lifecycle setup vs. addon registration vs. event binding). Not urgent — file is focused, tests cover it, but watch it.
- **`onWriteParsed` scroll snapshot accuracy under high write volume** — untested with pathological write rates (e.g., `cat /dev/urandom | xxd`). The per-write snapshot overhead is O(n writes). Needs a stress test before shipping WebGL-heavy workloads. Owner: whoever next touches scroll performance.
- **Dependency audit on `beta` merge** — `@xterm/addon-webgl` 0.19 and `@xterm/addon-fit` 0.11 need a pass through changelogs for any breaking behavior changes beyond what was handled. Didn't find issues in testing, but wasn't exhaustive.
