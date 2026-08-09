# Phase 3 Polish: Context Window Breakdown Feature Complete

**Date**: 2026-04-24 18:45  
**Severity**: Low (feature completion, polish)  
**Component**: Context Window Analyzer + Renderer UI  
**Status**: Resolved  

## What Happened

Shipped Phase 3 polish on the context window breakdown feature (`plans/260423-2258-context-window-breakdown/`). Added feature flag gating, full ARIA accessibility pass, stale indicator, error hardening, and settings UI toggle. Feature plan now fully complete across all 3 phases.

## The Brutal Truth

Phase 3 was pure polish and it felt good. No architectural debates, no major refactors—just systematic hardening. Added 8 tests, zero typecheck errors, 962 tests pass repo-wide. The stale indicator alone prevents user confusion when the IPC feed stutters. ARIA pass ensures screen reader users get full context breakdowns without mangling. This is clean delivery.

## Technical Details

**Feature flag**: `AppSettings.enableContextWindow` (default true, startup-only). Gates both main-process `ContextWindowAnalyzer` registration + renderer `<ContextWindowDrawer />` mount.

**Error hardening** (`context-window-analyzer.ts`): Try-catch wraps the per-line categorization loop (lines 80-95). On exception, `reportError()` emits a single `error` event per session (never crashes main, never logs spam via `errorReported` flag).

**Stale detection** (`useContextSnapshot` hook): Returns `{ snapshot, isStale }`. `isStale` flips true after 10s (`STALE_THRESHOLD_MS = 10_000`) of no incoming snapshot. On next snapshot, resets to false. Drawer renders a "Stale" chip with title tooltip. Prevents user panic when context stops updating.

**ARIA structure**:
- Drawer: `role="complementary"` + `aria-label="Claude context window breakdown"`
- Category rows: `role="listitem"` on container, `tabIndex={0}` for keyboard nav
- Progress bars: `role="progressbar"` + `aria-valuenow` (tokens), `aria-valuemin={0}`, `aria-valuemax` (max of session total or current bucket)
- Fill div: `aria-hidden` (decorative)

**formatTokens promoted**: Moved from inline to `@shared/utils/format-tokens.ts`. Guards for negatives, NaN, Infinity (all collapse to "0"). Tested: 11 cases cover <1k, 1k–1M, ≥1M, edge cases.

**Settings UI**: New Context Window Breakdown card in Terminal Settings tab. ToggleSwitch + "requires restart" helper text. Wired via `setEnableContextWindow` store action.

## What We Tried

1. Considered installing `@axe-core/react` for automated ARIA testing — rejected. Wrote structural assertion instead (YAGNI for P3, avoids heavy dep, still validates DOM shape).
2. Debated live toggle (disable analyzer mid-run) — too error-prone. Kept startup-only, reflected in UI copy ("requires restart").
3. Drafted 7th category ("harness-inject") — deferred. Hook injections continue rolling into `claude-md` bucket (decision from red-team M1).

## Root Cause Analysis

Not a failure; this was systematic hardening. Phase 2 shipped the core breakdown logic, Phase 3 added safety rails: error swallow, stale detection, accessibility semantics, feature flag. No technical debt, no scope creep—Phase 2 worked, Phase 3 made it production-ready.

## Lessons Learned

1. **Stale indicators matter.** IPC hiccups are normal in Electron; users need visual feedback that streaming stopped. 10s threshold catches real issues without false positives.
2. **Accessibility = usability.** ARIA progressbar semantics aren't optional. Screen readers now announce "Messages: 45.2k tokens, 23.5%"—crisp, testable, no hacks.
3. **Feature flags are cheap.** This flag cost 5 lines and lets us ship mature + disabled. Users opt-in after restart, we keep control. Worth the extra test.
4. **Single error event per session.** Instead of spamming `error` on every bad line, emit once. Prevents log spam, still catches the failure.

## Next Steps

Phase 3 is closed. Two follow-up buckets for later:

1. **P2 deferred ideas**: Compaction timeline (how fast buckets grow), per-tool drill-down (drill messages by tool type), disk-validated @-mentions (validate @file references against actual paths).
2. **Category refinement**: Collect user feedback. If "harness-inject" shows up in real sessions as >5% of budget, introduce as 7th category. Current rollup into `claude-md` is pragmatic; premature splitting adds UI clutter.

All code merged to master. Feature ready for next release cycle.

## Unresolved

1. **P2 deferred tracking:** Where do "compaction timeline" + "per-tool drill-down" land in the roadmap? Schedule them or drop them?
2. **7th category decision:** Monitor real usage. If "harness-inject" content >5% of typical session, introduce it. Otherwise leave merged.
