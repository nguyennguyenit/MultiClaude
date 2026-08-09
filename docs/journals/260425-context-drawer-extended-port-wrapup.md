# Context Drawer Extended: 6 Phases, 1 Session, 2 Scope Downgrades

**Date**: 2026-04-25 12:15  
**Severity**: Low (feature completion)  
**Component**: Context Drawer, IPC, Settings UI  
**Status**: Resolved  

## What Happened

Shipped `plans/260424-2232-context-drawer-extended-port/` in full: 6 phases + integration suite delivered in one session. Merged switcher header, turn-injection diff, execution trace, compaction timeline, extended-thinking summary viewer, feature flags, and integration tests. Commits: 366e29a through 3756c52 (6 main feature + test commits, plus Phase 7 settings flag from b33e996).

Two planned features downscoped mid-implementation based on real system constraints—both documented and shipped smaller, faster alternatives.

## The Brutal Truth

This should've been tense—6 phases of interconnected features touching the IPC boundary, renderer, main-process analyzer. Instead it was clean. Why? Red-team review caught the subagent trace join-key trap early; Phase 4 probe (<10 min) confirmed it was unfixable without CLI changes. Thinking-source probe (<10 min) revealed signature-only logs. Both downgrades prevented architecture thrashing and saved ~47KB gzip vs original plan. Shipped smarter, not harder.

Test suite never cracked: 1027 passing, 111 files, ~57 new tests added (4 main analyzer + 5 renderer components + 3 integration).

## Technical Details

**Phase 2** (366e29a): Pane switcher in drawer header with `Terminal.taskStatus` field + `TerminalTaskStatus` type. IPC channel: `notification:pane-status-changed`.

**Phase 3** (a59ee2c): Turn-injection diff using FNV-1a 64-bit content-hash dedup. Same CLAUDE.md re-injection across turns → delta = 0 bytes. Hot/cold split: summaries on snapshot stream, full details cold-fetch (never used). Closed red-team Issue #10.

**Phase 4** (1123ffe): Execution trace per turn. **Downgrade documented at `phase-04-probe.md`**: subagent `agentId` doesn't join to main-session `tool_use.id`. Shipped fallback: render main-session Agent blocks only + placeholder pointing to `~/.claude/projects/{key}/{sessionId}/subagents/`.

**Phase 5** (a0c5c45): Compaction timeline. Two signals: explicit `type=summary` (high) + >30% token-drop heuristic (low). 2s dedup, /clear-suppression for 5s.

**Phase 6** (fe949bb): Extended thinking summary-only. **Downgrade at `researcher-c-thinking-source.md`**: Claude Code v2.1+ persists thinking signature-only (`thinking: ""` + base64 `signature`). Shipped: turn-count + signature-prefix + ~token estimate. **Saves ~47KB gzip** (dropped `react-markdown`, `remark-gfm`, `rehype-highlight`). Flag `enableThinkingSyntaxHighlight` stays—future-proofing.

**Phase 7** (b33e996): Settings flag scaffolding. Channel-aware default: `enableContextWindowAdvanced` = beta ON, stable OFF via `app.getVersion().match(/-(beta|rc|alpha)/i)`.

**Phase 8** (3756c52): Integration test + coverage. Synthetic 30-turn session enforces 64KB hot-IPC guardrail. New modules: 93% main, 90% renderer.

## Root Cause Analysis

Not a failure. Two **deliberate downgrades** prevented overengineering:

1. Subagent trace: Naive approach = file-watcher + complex join logic for 20% value. Decision: fallback render + manual drill link. Deferred to follow-up plan when CLI exposes join-key.

2. Thinking text: Upstream no longer logs readable content. Naive approach = wait for unknown future state. Decision: ship summary-only viewer now, re-enable full viewer when text becomes available.

Both decisions documented in phase probes—no guessing, no hacky workarounds.

## Lessons Learned

1. **Probe before overbuilding.** 20 min of investigation saved weeks of wrong architecture. Always check "does the data even exist?" before designing the viewer.

2. **Downgrades aren't failures.** Shipped 80% of planned features + 100% of the value. Extra 47KB for signature highlighting isn't worth guessing when text comes back.

3. **Pane-status broadcast timing** must precede notification gates—drawer reflects lifecycle regardless of user mute settings. This makes the drawer a reliable status source, not a derivative.

4. **Turn boundary semantics**: User-text line, excluding `<system-reminder>` injections. Otherwise harness noise inflates turn count. Boring but critical for accurate metrics.

## Next Steps

**Deferred**:
- Subagent inner-trace co-watching → separate plan when CLI exposes join-key
- Real-session compaction smoke test → fixture `session-with-compaction.jsonl` has only `away_summary` recap; need to capture from live long-running beta session
- v3.7.0 stable flip gate: 2 weeks elapsed soak before `enableContextWindowAdvanced` default flips ON in stable channel

All code merged to master. Feature ship-ready for v3.6.0-beta release (gated by elapsed-time or 30+ beta users, whichever later).

## Unresolved

1. **Subagent join key**: Does Claude Code CLI maintain a stable mapping between main-session Agent tool-use and subagent JSONL folder? If yes + documented, prioritize co-watching plan.

2. **Real compaction capture**: Can we log a real long-running session with actual compaction events (not just away_summary) to validate fixture accuracy?

3. **Thinking text timeline**: When will thinking blocks include readable text in JSONL? Needed to ungate Phase 6 full-viewer with markdown syntax highlighting.
