# Brainstorm: Notification Tracking System

**Date:** 2026-01-06
**Branch:** feature/terminal-rendering-mode
**Status:** Agreed

---

## Problem Statement

Current notification system in MultiClaude uses simple regex pattern detection with 5-second debounce. Limitations:

1. **No task name extraction** - Only shows generic "Task completed" messages
2. **Limited detection** - Exit codes not captured from PTY events
3. **Spam potential** - Time-based debounce allows repeated notifications for same task
4. **No focus awareness** - Notifies even when user is actively watching terminal

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **Task Complete** | Extract task name from TodoWrite output, support both JSON stream and plain text modes |
| **Task Failed** | Detect via regex patterns AND PTY exit code events |
| **Review Needed** | Detect AskUserQuestion, Y/N prompts, permission requests |
| **Anti-spam** | Unique task ID tracking (not time-based), per-terminal-session reset |
| **Background only** | Notify only when window unfocused OR terminal tab inactive |
| **External platforms** | Rich format for Telegram (HTML) and Discord (Embed), adapt per platform |

---

## Evaluated Approaches

### A1: Enhanced Pattern Detection
**Pros:** Quick to implement, minimal changes
**Cons:** Task names unreliable, regex fragile, no structured data

### A2: Dual-mode Parser ✅ SELECTED
**Pros:** Accurate task extraction via JSON stream, fallback to text patterns, flexible
**Cons:** Two parsing modes to maintain, settings complexity

### A3: Stateful Output Analyzer
**Pros:** Most intelligent, context-aware
**Cons:** Over-engineered, complex state management, slower

---

## Final Solution: A2 Dual-mode Parser

### Architecture

```
TerminalManager.onData
        │
        ▼
┌───────────────────────────────────────────┐
│            OutputParser (Router)           │
│  ┌─────────────────┐ ┌──────────────────┐ │
│  │JsonStreamParser │ │PlainTextParser   │ │
│  │(--stream-json)  │ │(Enhanced regex)  │ │
│  └────────┬────────┘ └────────┬─────────┘ │
│           └────────┬──────────┘           │
│                    ▼                      │
│         ┌───────────────────┐             │
│         │ TaskEventEmitter  │             │
│         └─────────┬─────────┘             │
└───────────────────┼───────────────────────┘
                    ▼
┌───────────────────────────────────────────┐
│      NotificationManager (Enhanced)        │
│  ┌─────────────────────────────────────┐  │
│  │ TaskTracker (unique ID dedup)       │  │
│  │ FocusDetector (window + tab)        │  │
│  └─────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Native   │ │ Telegram │ │ Discord   │  │
│  │ Notif    │ │ (HTML)   │ │ (Embed)   │  │
│  └──────────┘ └──────────┘ └───────────┘  │
└───────────────────────────────────────────┘
```

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `OutputParser` | `src/main/notification/output-parser.ts` | Route between JSON/text parsers |
| `JsonStreamParser` | `src/main/notification/json-stream-parser.ts` | Parse Claude Code stream-json format |
| `PlainTextParser` | `src/main/notification/plain-text-parser.ts` | Enhanced regex for text mode |
| `TaskTracker` | `src/main/notification/task-tracker.ts` | Unique task ID dedup |
| `FocusDetector` | `src/main/notification/focus-detector.ts` | Window + tab focus detection |

### Modified Components

| Component | Changes |
|-----------|---------|
| `TerminalManager` | Add option for `--output-format=stream-json` |
| `NotificationManager` | Integrate TaskTracker, FocusDetector |
| `notification-handlers.ts` | Add IPC for new settings |
| `NotificationSettings` type | Add new fields |
| Settings UI | New toggles for output mode, notification behavior |

---

## Implementation Details

### 1. JSON Stream Events Mapping

```typescript
// Claude Code stream-json events → NotificationEventType
const EVENT_MAPPING = {
  // TodoWrite tool with status=completed
  { type: 'tool_use', name: 'TodoWrite', status: 'completed' } → 'taskComplete',

  // Tool result with error or non-zero exit
  { type: 'tool_result', is_error: true } → 'taskFailed',
  { type: 'tool_result', exit_code: != 0 } → 'taskFailed',

  // AskUserQuestion tool invocation
  { type: 'tool_use', name: 'AskUserQuestion' } → 'reviewNeeded',

  // Permission prompts
  { type: 'permission_request' } → 'reviewNeeded'
}
```

### 2. Enhanced Plain Text Patterns

```typescript
export const DETECTION_PATTERNS = {
  // Task Complete - with name capture group
  taskComplete: /✓\s+(.+?)(?:\s*\(completed\)|$)/i,

  // Task Failed - patterns + exit code
  taskFailed: /✗\s+(.+?)(?:\s*\(failed\)|$)|exit(?:ed)?\s+(?:with\s+)?code\s+(\d+)/i,

  // Review Needed - multiple triggers
  reviewNeeded: /\[Y\/n\]|\(y\/N\)|approve|allow\s+(?:this\s+)?tool|waiting\s+for\s+(?:your\s+)?(?:input|response|confirmation)/i
}
```

### 3. Unique Task ID

```typescript
interface TaskEvent {
  id: string          // SHA256(terminalId + taskContent + type)
  terminalId: string
  type: NotificationEventType
  taskName: string    // Extracted task name
  projectName: string // From terminal metadata
  context?: string    // Last tool, duration, etc.
  timestamp: number
}

class TaskTracker {
  private seenTasks: Map<string, Set<string>> = new Map() // terminalId → Set<taskId>

  shouldNotify(event: TaskEvent): boolean {
    const seen = this.seenTasks.get(event.terminalId) || new Set()
    if (seen.has(event.id)) return false
    seen.add(event.id)
    this.seenTasks.set(event.terminalId, seen)
    return true
  }

  clearTerminal(terminalId: string): void {
    this.seenTasks.delete(terminalId)
  }
}
```

### 4. Focus Detection

```typescript
class FocusDetector {
  private window: BrowserWindow
  private activeTerminalId: string | null = null

  setActiveTerminal(terminalId: string): void {
    this.activeTerminalId = terminalId
  }

  shouldNotify(terminalId: string): boolean {
    // Notify if window unfocused OR different terminal active
    if (!this.window.isFocused()) return true
    if (this.activeTerminalId !== terminalId) return true
    return false
  }
}
```

### 5. Rich Platform Messages

**Telegram (HTML):**
```html
✅ <b>Task Complete</b>
<b>Project:</b> MultiClaude
<b>Task:</b> Fix authentication bug
<b>Terminal:</b> main-dev
<b>Duration:</b> 2m 34s
```

**Discord (Embed):**
```json
{
  "embeds": [{
    "title": "✅ Task Complete",
    "color": 5763719,
    "fields": [
      { "name": "Project", "value": "MultiClaude", "inline": true },
      { "name": "Task", "value": "Fix authentication bug", "inline": true },
      { "name": "Terminal", "value": "main-dev", "inline": true }
    ],
    "timestamp": "2026-01-06T10:45:00.000Z"
  }]
}
```

---

## Settings Changes

New fields in `NotificationSettings`:

```typescript
interface NotificationSettings {
  // Existing
  onTaskComplete: boolean
  onTaskFailed: boolean
  onReviewNeeded: boolean
  soundEnabled: boolean
  soundPreset: SoundPreset
  telegramEnabled: boolean
  telegramConfigured: boolean
  discordEnabled: boolean
  discordConfigured: boolean

  // NEW
  outputMode: 'auto' | 'stream-json' | 'plain-text'  // Default: 'auto'
  notifyOnlyBackground: boolean                       // Default: true
  includeTaskSummary: boolean                         // Default: true
}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON stream changes Claude output appearance | Medium | Make optional, default to 'auto' |
| PTY exit code fires on shell commands, not just Claude | Low | Only track when `isClaudeMode=true` |
| Regex false positives | Medium | Use JSON stream as primary, text as fallback |
| Performance with frequent parsing | Low | Debounce at parser level, efficient regex |

---

## Success Metrics

- [ ] Task names correctly extracted in 95%+ cases with stream-json
- [ ] Task names correctly extracted in 80%+ cases with plain text
- [ ] Zero duplicate notifications for same task
- [ ] Notifications only appear when app/terminal unfocused
- [ ] Telegram/Discord messages contain all required info
- [ ] No false positive `reviewNeeded` on normal tool output

---

## Dependencies

- Claude Code CLI supporting `--output-format=stream-json`
- Existing NotificationManager architecture
- Zustand stores for settings

---

## File Changes Summary

**New files (6):**
- `src/main/notification/output-parser.ts`
- `src/main/notification/json-stream-parser.ts`
- `src/main/notification/plain-text-parser.ts`
- `src/main/notification/task-tracker.ts`
- `src/main/notification/focus-detector.ts`
- `src/shared/types/notification-events.ts`

**Modified files (7):**
- `src/main/terminal/terminal-manager.ts` - Add stream-json option
- `src/main/notification/notification-manager.ts` - Integrate new components
- `src/main/notification/discord-notifier.ts` - Rich embed format
- `src/main/ipc/notification-handlers.ts` - New IPC handlers
- `src/shared/constants/notification.ts` - Enhanced patterns
- `src/shared/types/notification.ts` - New settings fields
- `src/renderer/components/settings/notification-settings.tsx` - New UI

---

## Next Steps

1. Create detailed implementation plan with task breakdown
2. Implement OutputParser infrastructure
3. Add JSON stream parsing
4. Enhance plain text patterns
5. Implement TaskTracker with unique ID
6. Add FocusDetector
7. Update Telegram/Discord formatters
8. Add settings UI
9. Write tests
10. Documentation update

---

## Unresolved Questions

1. **JSON stream format stability** - Need to verify Claude Code's stream-json format hasn't changed
2. **AskUserQuestion detection** - Exact JSON structure for this tool event?
3. **Permission prompt format** - How are dangerous tool approvals formatted in stream-json?
