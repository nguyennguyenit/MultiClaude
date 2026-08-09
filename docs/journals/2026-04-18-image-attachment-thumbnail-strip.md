# Image Attachment Thumbnail Strip Shipped

**Date**: 2026-04-18 00:17  
**Severity**: Low  
**Component**: Terminal UI / Media System  
**Status**: Resolved  

## What Happened

Shipped "Image Attachment Thumbnail Strip" (commit 68d825b) — a DOM-based horizontal carousel showing thumbnails of dropped images/videos above each terminal pane. Seven-phase TDD implementation with 33 new tests. All 903 tests green, typecheck clean.

## The Brutal Truth

This feature felt deceptively simple until we hit the zustand test infinite loop. Ten minutes spent tracing React's internal equality checks taught us something real about store selectors — but it made us paranoid about shipping stale state bugs. The Ctrl+C gap was pure plan-documentation carelessness: the manual QA checklist asserted behavior that wasn't wired into any phase file. Both are fixed, but they're the kind of gaps that slip to production if you skip the discipline.

## Technical Details

**What shipped:**
- IPC handler `media:read-data-url` uses Electron `nativeImage.createFromPath().resize()` to cap thumbnail bytes (no `sharp` dependency)
- Store layer: `removeImage()` and `pendingMediaStore.removeTokenByPath()` keep Claude mode and token mode in sync
- Component: `AttachmentStrip` renders tiles with ✕ button, fixed 80x60, `overflow-x: auto` for scrolling
- Auto-clear on Enter/Ctrl+C via `createOnDataHandler` integration
- Phase 06 documented Claude-mode limitation: removing a thumbnail doesn't erase Claude Code's internal `[Image N]` buffer (we don't own it)

**Key constraint:** Ctrl+C now clears the strip by extending xterm data observer from `data === '\r'` to `data === '\r' || data === '\x03'`.

## What We Tried

1. **Sixel rendering** — rejected. xterm.js doesn't expose sixel as first-class in our setup; GPU rendering would require tight coupling to xterm internals. DOM strip decouples us.
2. **Sharp dependency for thumbnails** — rejected. Electron's `nativeImage` pipeline already validates file extensions and reuses existing security model. Zero native-module churn.
3. **Default fallback in store selector** — killed a zustand test loop. Initial: `useImageStore((s) => s.images[terminalId] ?? [])`. Problem: `?? []` creates fresh array on every render when terminal has no images, triggering React's `useSyncExternalStore` infinite snapshot check.

## Root Cause Analysis

### The Zustand + jsdom Trap

The selector `?? []` returned a new array reference every time the terminal had no entries. React's `useSyncExternalStore` hook detected the new snapshot and re-subscribed, which triggered the selector again, creating infinite loop. The fix: remove the fallback and inline the length check: `(s.images[terminalId] || []).length > 0 ? ... : null`. Now the selector returns either the actual array (which zustand's equality check memoizes) or `undefined` (also stable).

**Why this matters:** Store selectors are identity-sensitive. Never construct a fallback within the selector — it defeats equality checks and breaks React's memoization contract. Build the fallback in the component instead.

### The Ctrl+C Parity Gap

Phase 07's manual QA checklist included "Ctrl+C after drop clears strip" — reasonable expectation. But scanning the 6 phase implementation steps, none explicitly wired Ctrl+C into the clear path. Initial code only handled `\r` (Enter). The phase doc and checklist diverged silently. Fix was simple (extend the conditional), but the gap revealed that QA checklists are a second spec that drifts from phase files. One-directional reference (checklist → code) isn't enough.

## Lessons Learned

1. **Zustand selector contracts are sacred.** Always return the same reference for the same state. If you need a fallback, do it outside the selector in the component. The infinite loop taught us zustand isn't magic — it's just equality checks on snapshots.

2. **Plan QA checklists are executable specs, not decorative.** Scan them against phase implementation steps during code review, not only at the end. A one-line checklist item can hide a missing feature in the phase doc.

3. **DOM over GPU when decoupling matters.** The sixel rejection was right not because DOM is faster (it isn't), but because a separate DOM layer doesn't bleed into xterm renderer state. One less coupling point = fewer emergent bugs.

4. **SVG fallback for video files via raw readFileSync.** `nativeImage` returns empty for SVG on macOS/Linux, so we load SVG icons directly. Electron's image pipeline doesn't normalize SVG → document this when it bites someone later.

## Next Steps

- Monitor production for any Ctrl+C edge cases (Ctrl+Z, Ctrl+U not tested manually yet — just automated coverage)
- Watch for the Claude-mode `[Image N]` UX complaint (documented limitation, expected)
- Consider extracting the zustand selector pattern into a reusable hook to prevent future infinite loops in related features

---

**Files:**  
`src/renderer/stores/image-store.ts` (removeImage)  
`src/renderer/utils/attachment-remove-handler.ts` (mode-aware remove logic)  
`src/renderer/components/terminal/attachment-strip.tsx` (carousel component)  
`src/main/ipc/media-read-data-url-handler.ts` (thumbnail generation)
