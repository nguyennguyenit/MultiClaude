# Terminal Split/Jump/Drag: Three Concurrent Bugs with Separate Root Causes

**Date**: 2026-04-24 10:00
**Severity**: High
**Component**: Terminal Pane Management (`use-terminal-init.ts`, `use-execute-split.ts`, `use-pane-resize.ts`, `App.tsx`)
**Status**: Resolved

## What Happened

User reported "mở terminal mới thì nhảy loạn xạ" (new pane jumps erratically) with screen recordings. Single shipping arc (`f24af6f`, `55d8829`, `55c8f5b`) that buried three distinct bugs surfacing simultaneously: new-pane jump-down, split-direction race resulting in wrong grid layout, and divider drag lag spiking to 1000+ms. Each had independent root cause and fix.

## The Brutal Truth

This was a nightmare of timing bugs that only showed together because adding headless snapshot replay (`a6f6397`) exposed a race condition that was always there but latent. The split-direction bug has lived for weeks — it was "works most of the time" until you split rapidly 4+ times, which is exactly what testers do. And drag lag was architectural: pointermove firing 120Hz directly into React setState with ResizeObserver callbacks. The jump was the most insidious — two separate sources writing to the same xterm at overlapping times, causing ANSI cursor positioning from snapshot to repaint over live-rendered content. The code comment even admitted "tolerated" the race — but mis-judged what "tolerated" meant.

## Technical Details

**Bug 1: New-pane jump (1-2 line drop)**

Root cause: `a6f6397` (headless snapshot restore) introduced dual-source xterm writes — live PTY stream + snapshot replay both writing simultaneously. No data conflict, but visual conflict: snapshot's ANSI cursor positioning + clear codes repainted over live-rendered content → visible jump on first prompt.

False lead: blamed `21545d9` (flex min-width unblock) for amplifying reflow flicker, not causing the jump itself.

Fix (`f24af6f`):
- `pauseAndBuffer()` at initTerminal start
- Write snapshot first
- `resumeAndFlush()` before live stream resumes
- Restored single-source write ordering
- Sync `fit()` + resize IPC right after `terminal.open()` so PTY learns correct cols/rows before shell prints first prompt

Key insight: Original `a6f6397` author rejected pauseAndBuffer: "delaying first prompt would be noticeable." But the jump it caused is *more* noticeable. Single-source invariant was pre-headless working assumption; snapshot replay broke it silently.

**Bug 2: Split direction race (split right 4× → 3 columns + 1 row)**

Root cause: `TERMINAL_CREATED` IPC broadcast and create-reply arrive non-deterministically on separate channels. When broadcast won, App.tsx's `onCreated` listener called `migrateFlatToTree` + reset to 2×2 grid before `executeSplit`'s `setTree` could place leaf at user's chosen direction. By the time App had rebuilt grid, the leaf position was already lost.

First fix (findLeaf guard) insufficient — at broadcast-check moment, executeSplit hadn't written tree yet.

Fix (`55d8829`):
- Module-level in-flight counter `beginRendererCreate()` set BEFORE create IPC
- Released AFTER `setTree` in both `useExecuteSplit` and `handleAddTerminal`
- `onCreated` skips rebuild when counter > 0
- Synchronizes the race by deferring rebuild until split's tree write is observable

**Bug 3: Divider drag lag**

Root cause: `pointermove` (60-120+ Hz on modern trackpads) directly calls `setTree` → full React re-render → all panes ResizeObserver → `fitAddon.fit()` + SIGWINCH IPC. Stack too heavy per event.

Fix (`55c8f5b`):
- rAF-coalesce ratio updates: max 1 `setTree` per frame
- Cleanup flushes pending so final rest position isn't lost
- Reduces drag event cascading from ~120/sec to 60/sec

## What We Tried

1. **Freeze overlay mask** — added UI mask to hide existing-pane reflow flicker after warning reflow is inherent to xterm.js. User saw mask flash as worse than flicker → reverted. Reflow remains known limitation.

2. **findLeaf guard for split race** — insufficient; race window closed too late.

3. **Direct fit() sync after terminal.open()** — needed for PTY to learn cols/rows before shell renders first prompt, otherwise snapshot rows don't match terminal rows.

## Root Cause Analysis

**Why didn't headless snapshot + live stream coexist safely?**

Pre-headless, live PTY stream was the SOLE writer to xterm — natural synchronization with shell. Snapshot replay added a *second* writer without pause/resume coordination. The two writes don't conflict on *data* (snapshot is old, live is current) but conflict on *rendering*: ANSI codes from snapshot execute out-of-order with live stream, repainting cursor position + screen clears over fresh content.

**Why did split direction race only show under rapid splits?**

React batches setState calls. Single split: broadcast and reply coalescence obscures race. Rapid splits: each is a separate batch, increasing window for broadcast to win before split's tree write is visible. Race was probabilistic, not guaranteed.

**Why is divider drag 1000+ms on slow machines?**

Each pointermove → setTree re-renders all panes (many ResizeObserver callbacks) → each fit() re-measures terminal + IPC → SIGWINCH → shell reflow. On machines with 6+ panes, this stack per event becomes untenable.

## Lessons Learned

1. **Two sources writing to xterm simultaneously = race condition.** The code comment "tolerated" was wrong. Pause/resume is mandatory when mixing snapshot replay + live stream. Single-source invariant is pre-headless assumption that must be explicit in headless code.

2. **IPC race conditions need synchronization before tree write, not after.** `onCreated` listener was racing against `executeSplit`'s tree mutation. The fix (in-flight counter deferring rebuild) works because it *prevents* the race window, not just guards against it. This pattern is reusable for any IPC race.

3. **High-frequency events need rAF throttling + cleanup.** pointermove is 60-120Hz; React setState per event is unsustainable. Coalesce to frame rate, flush pending state before frame completes. Test with `{ ratio: 3 }` on 6-pane layouts to measure.

4. **ResizeObserver + PTY SIGWINCH + rAF can create feedback loops.** fit() resizes canvas → ResizeObserver fires → another fit() call. With rAF coalescing, ensure cleanup releases all pending operations so final state is stable. Test by dragging dividers while shell is printing.

## Next Steps

- **Existing-pane reflow flicker remains** — inherent to xterm.js + PTY/shell architecture. Only fixable via custom block-based renderer (Warp-style). Documented as known limitation. No owner, no timeline.
- **Drag lag on 6+ pane layouts** — rAF coalescing may still be insufficient. Needs stress test: drag dividers while running high-output shell command on machine with >4 panes. If still laggy, consider: (a) per-pane fit queuing instead of full-tree, (b) canvas resize debounce, (c) SIGWINCH batching. Owner: next perf pass.
- **PTY cols/rows sync timing** — fit() + SIGWINCH IPC placement after terminal.open() is correct but undocumented. Add comment explaining shell needs cols/rows before first prompt. Owner: code review on similar changes.

## Unresolved Questions

- Is rAF coalescing with ratio=1 sufficient for 8-pane layouts, or does fit() overhead require per-pane queuing?
- Can we detect when reflow flicker is about to happen and preemptively batch shell output (flow control)?
