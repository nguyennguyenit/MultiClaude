# Context Drawer Extended — Design Spec

**Plan:** `plans/260424-2232-context-drawer-extended-port/`
**Status:** Phase 1 synthesis — locked for Phase 2-8 implementation
**Date:** 2026-04-24

## 1. Scope recap

Port 4 advanced context features from `matt1398/claude-devtools` into MultiClaude's existing Context Window Drawer (v3.5.0), merged behind `enableContextWindowAdvanced` flag.

Features: Turn-Injection Diff · Execution Trace · Compaction Viz · Extended Thinking Viewer. Switcher merged into drawer header.

## 2. Current baseline (measured)

### ContextSnapshot (verbatim, `src/shared/types/context-window.ts`)

```ts
interface ContextSnapshot {
  sessionId: string
  cwd?: string
  buckets: Record<ContextCategory, CategoryBucket>  // 6 buckets
  total: number
  updatedAt: number
}
interface CategoryBucket { tokens: number; chars: number; itemCount: number }
type ContextCategory =
  | 'claude-md' | 'mentioned-file' | 'tool-output'
  | 'thinking-text' | 'task-coordination' | 'user-messages'
```

### IPC

| Channel | Direction | Cadence | Payload |
|---|---|---|---|
| `context:snapshot` | main→renderer broadcast | 300ms debounce | ContextSnapshot |
| `context:get` | renderer→main invoke | on-demand | ContextSnapshot \| null |

Preload: `window.electron.context.{getSnapshot, onSnapshot}` (`src/preload/index.ts:207-210`).

### Baseline payload size (estimated from type + typical values)

| Bucket | Fixed bytes | Growth bound |
|---|---|---|
| sessionId (UUID) | 36 | fixed |
| cwd | ~80 | bounded (path) |
| 6× CategoryBucket | ~180 | bounded (3 numbers) |
| total, updatedAt | 16 | fixed |
| **Subtotal** | **~312 B** | — |

Estimated: **p50 ~450 B · p95 ~2-3 KB · max ~5-8 KB** (active long session). Budget `≤64 KB p95` has **substantial headroom** for the new summary fields; bulky content must not ride hot channel.

## 3. JSONL schema reference (from Researcher A — 10 real sessions)

| Feature | Field path | Shape | Coverage | Notes |
|---|---|---|---|---|
| Thinking | `message.content[].type === 'thinking'` | `{type, thinking, signature}` | 26 blocks / 10 sessions | `thinking` text often **empty** (signature-only); rely on `message.usage` for tokens |
| Token deltas | `message.usage.iterations[0]` | `{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}` | 100% assistant msgs | source-of-truth for per-turn deltas |
| Turn boundary | `uuid` / `parentUuid` chain + `timestamp` (ISO-8601) | linked list | 100% | reconstruct via parent walk |
| Compaction | `type === 'system'` content keyword match: `context\|summariz\|compact\|overflow` | heuristic | not explicit field | **schema guard** must tolerate future explicit markers |
| Task tool | (not observed in main JSONL — likely `~/.claude/projects/{id}/subagents/agent-*.jsonl`) | TBD | 0% main stream | Phase 4 investigates subagent folder |

### Schema-guard contract (mandatory for Phase 3-6)

```ts
function safeParse<T>(line: string, shape: (j: unknown) => T | null): T | null {
  try { const j = JSON.parse(line); return shape(j) } catch { return null }
}
```
Unknown types logged once per kind via `logger.debug('unknown-jsonl-kind', ...)`, never throw.

## 4. IPC contract additions (LOCKED)

### Hot channel — `context:snapshot` (backward-compatible superset)

```ts
interface ContextSnapshot {
  // existing (unchanged)
  sessionId: string
  cwd?: string
  buckets: Record<ContextCategory, CategoryBucket>
  total: number
  updatedAt: number
  // NEW — all optional, gated by enableContextWindowAdvanced
  turnDeltaSummaries?: TurnDeltaSummary[]    // cap 50
  compactionMarkers?: CompactionMarker[]     // cap 10
  executionTraceSummary?: TraceSummary       // counts only
  thinkingSummary?: ThinkingSummary          // counts only
}

interface TurnDeltaSummary {
  turnId: string           // uuid of assistant message
  parentTurnId?: string
  timestamp: number        // ms epoch
  totalDelta: number       // tokens added this turn
  perCategory: Partial<Record<ContextCategory, number>>
  // no items[] on hot channel — pull via cold
}

interface CompactionMarker {
  id: string               // stable hash
  timestamp: number
  beforeTokens: number
  afterTokens: number
  detectionMethod: 'explicit' | 'heuristic'
}

interface TraceSummary { turnCount: number; toolCallCount: number; subagentCount: number }
interface ThinkingSummary { blockCount: number; totalTokens: number }
```

**Byte budget check:** 50 × TurnDeltaSummary (~200 B each w/ JSON) + 10 × CompactionMarker (~120 B each) + summaries ≈ **12 KB p95**. Well under 64 KB budget.

### Cold channel — new pull IPC (renderer→main invoke, registered in `src/main/ipc/context-handlers.ts`)

```ts
'context:get-turn-details'   (turnId: string) → { items: TurnItem[]; contentHashes: string[] }
'context:get-execution-trace'(turnId: string) → TraceNode[]
'context:get-thinking-block' (turnId: string) → { content: string; tokens: number; signature?: string }
```

Preload additions (exposed on `window.electron.context`):
```ts
getTurnDetails(turnId): Promise<TurnDetails>
getExecutionTrace(turnId): Promise<TraceNode[]>
getThinkingBlock(turnId): Promise<ThinkingBlock>
```

## 5. Algorithms (distilled from Researcher B — upstream pseudocode)

### 5.1 Turn-injection diff
```
for each assistant message in order of parent chain:
  delta = usage.input_tokens_new - prev.usage.input_tokens_cached_total
  perCategory = categorize(content_blocks_added_since_parent)
  emit TurnDeltaSummary {turnId, totalDelta, perCategory}
cap history at last 50 turns (ring buffer)
```

### 5.2 Execution trace (per turn)
```
steps = []
for each content_block in turn:
  if type=='thinking'  → steps.push {kind:'thinking', tokens}
  if type=='tool_use'  → steps.push {kind:'tool_call', name, input, useId}
  if type=='text'      → steps.push {kind:'output', text}
for each user_result linked by toolUseId → attach to matching tool_call
group parallel tool_calls (same turn, same timestamp window) as {isParallel: true}
TraceNode = {kind, label, tokens, children?, startMs, endMs}
```

### 5.3 Compaction viz
```
detect compact at system-message keyword match OR explicit field if present
preTokens  = last total before marker
postTokens = first total after marker
emit CompactionMarker {id: hash(timestamp+preTokens), timestamp, beforeTokens, afterTokens}
cap 10 most recent
```

### 5.4 Extended thinking
```
for each content_block type=='thinking':
  tokens = usage-based prorate OR len(text)/4 fallback
  store {turnId, content: thinking || '', signature, tokens}
hot payload: count + totalTokens only
full content via cold channel on demand
```

## 6. Feature flag semantics (LOCKED)

| Flag | Default stable | Default beta | Live toggle | Lazy chunk |
|---|---|---|---|---|
| `enableContextWindow` | ON (v3.5.0) | ON | startup-only | — |
| `enableContextWindowAdvanced` | **OFF** | **ON** | startup-only | — |
| `enableThinkingSyntaxHighlight` | OFF | OFF | startup-only | **YES** (`rehype-highlight` via dynamic `import()`) |

**Channel detect:** `app.getVersion().match(/-(beta|rc|alpha)/i)` → beta path.

**Stable-flip gate (v3.7.0):** 2 weeks elapsed since v3.6.0-beta. No telemetry required (per interview decision #3).

Settings UI (`src/renderer/components/settings/...`): all three toggles show "Restart required" tooltip.

## 7. Dependencies (LOCKED)

| Dep | Size (gzip) | When loaded |
|---|---|---|
| `react-markdown@9` | ~20 KB | always (base bundle) |
| `remark-gfm` | ~2 KB | always |
| `rehype-highlight@7` | ~25 KB | lazy (`import()` only if user flag ON) |
| `xxhash-wasm` OR FNV-1a | ~5 KB / 0 KB | Phase 3 picks |

**Vite config:** chunk-split highlighter via `manualChunks: { 'syntax-highlight': ['rehype-highlight'] }`.

**Initial bundle delta:** ≤ +22 KB gzip (budget ≤50 KB PRESERVED).

## 8. Drawer layout (merged switcher, advanced sections)

See `drawer-prototype.html`. Breakpoints: 1280×720 (compact) · 1920×1080 (full).

```
┌─ ContextWindowDrawer header ────────────────────────────────────┐
│ [◎ Pane A] [○ Pane B] [○ Pane C]          [× close]            │
├─────────────────────────────────────────────────────────────────┤
│ ══════════ Stacked bar (6 categories) ═══════════  45k / 200k  │
├─────────────────────────────────────────────────────────────────┤
│ ▸ Turn-Injection Diff            (flag:advanced)    [expand]    │
│ ▸ Execution Trace                (flag:advanced)    [expand]    │
│ ▸ Compaction Timeline            (flag:advanced)    [expand]    │
│ ▸ Extended Thinking              (flag:advanced)    [expand]    │
└─────────────────────────────────────────────────────────────────┘
```

Section open/close state persisted per-user in settings-store (`drawerSectionState: Record<string, boolean>`).

## 9. Extension points map (from Scout)

| Concern | File | Addition |
|---|---|---|
| Computation | `src/main/context/context-window-analyzer.ts` | `handleLine()` branches for thinking/compact/task; new `computeTurnDelta()` |
| JSONL watch | `src/main/notification/claude-log-watcher.ts` | no change (already emits `jsonlLine`) |
| IPC register | `src/main/ipc/context-handlers.ts` | 3 new cold-channel handlers |
| Preload bridge | `src/preload/index.ts` (`context` namespace @ 207-210) | 3 new methods |
| Types | `src/shared/types/context-window.ts` | superset additions to ContextSnapshot |
| Settings | `src/shared/types/index.ts` (AppSettings) + `src/renderer/stores/settings-store.ts` | 2 new flags, defaults |
| Renderer hook | `src/renderer/hooks/use-context-snapshot.ts` | passthrough new optional fields |
| Drawer UI | `src/renderer/components/context-window/context-window-drawer.tsx` | header switcher + 4 advanced sections |
| Settings UI | existing settings panel | 3 toggles + section header "Advanced Context Window" |
| App wiring | `src/renderer/App.tsx:629-631` | pass both flags to drawer |

## 10. Unresolved / deferred

1. **Task tool calls** not observed in main JSONL — Phase 4 must probe `~/.claude/projects/{id}/subagents/agent-*.jsonl` before finalizing execution-trace subagent node.
2. **Compaction explicit field** not found in 10 sampled sessions. Heuristic keyword match ships; add `detectionMethod: 'heuristic' | 'explicit'` so forward-compat is free.
3. **Thinking text empty** in signature-only mode — viewer must render graceful "[signature-only, no text logged]" placeholder.
4. **Bundle guard:** Phase 8 adds CI check comparing `dist-bundle-size.json` against 50 KB ceiling.

## 11. Traceability

- Fixtures: `tests/fixtures/session-{baseline,multi-turn,with-thinking,with-compaction}.jsonl` (committed Phase 1 — 645 KB total, anonymized)
- Schema contract test: `tests/design/schema-contract.test.ts` (stub; Phase 3-6 each flips 1 assertion green)
- Reports: `plans/260424-2232-context-drawer-extended-port/reports/{scout-context-analyzer-map,researcher-a-jsonl-schema,researcher-b-upstream-algorithms}.md`
