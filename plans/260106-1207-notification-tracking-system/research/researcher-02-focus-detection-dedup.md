# Research: Electron Focus Detection & Task Deduplication

**Date:** 2026-01-06 | **Scope:** Background-only notifications with deduplication

---

## 1. Window Focus Detection (Electron)

### Main Process Events

```typescript
// Per-window focus tracking
mainWindow.on('focus', () => { windowFocused = true })
mainWindow.on('blur', () => { windowFocused = false })

// Check current state synchronously
if (mainWindow.isFocused()) { /* skip notification */ }
```

### Gotchas

- **Linux/Wayland:** Focus detection unreliable; may need `--ozone-platform=x11`
- **webContents vs BrowserWindow:** `win.on('focus')` = OS window; `webContents.on('focus')` = DOM element
- **Renderer sync:** Focus state in main process; use IPC to sync if needed

---

## 2. Active Tab/Terminal Tracking

```typescript
class FocusTracker {
  private windowFocused = false
  private activeTerminalId: string | null = null

  constructor(window: BrowserWindow) {
    window.on('focus', () => { this.windowFocused = true })
    window.on('blur', () => { this.windowFocused = false })
  }

  shouldNotify(terminalId: string): boolean {
    return !this.windowFocused || this.activeTerminalId !== terminalId
  }
}
```

---

## 3. SHA256 Hashing in Node.js

```typescript
import { createHash } from 'crypto'

function hashTaskId(terminalId: string, pattern: string, content: string): string {
  return createHash('sha256')
    .update(`${terminalId}:${pattern}:${content}`)
    .digest('hex')
    .slice(0, 16)  // 16 chars sufficient for dedup
}
```

**Performance:** ~0.3ms for small strings - negligible for notification frequency

---

## 4. Map-Based Deduplication

```typescript
class TaskDeduplicator {
  private seen = new Map<string, number>()
  private ttlMs = 5 * 60 * 1000  // 5 min TTL

  isDuplicate(hash: string): boolean {
    const now = Date.now()
    const lastSeen = this.seen.get(hash)
    if (lastSeen && now - lastSeen < this.ttlMs) return true
    this.seen.set(hash, now)
    return false
  }

  resetForTerminal(terminalId: string): void { this.seen.clear() }
  cleanup(): void { /* remove stale entries */ }
}
```

---

## 5. Integration with Existing NotificationManager

Current code already has:
- `window` reference (line 14)
- `cleanupInterval` (line 28)
- `processOutput()` entry point (line 49)

**Add:**
```typescript
private windowFocused = true
private activeTerminalId: string | null = null
private seenTasks = new Map<string, number>()

// In triggerNotification():
if (this.windowFocused && this.activeTerminalId === terminalId) return
const hash = this.hashTask(terminalId, type, message)
if (this.isDuplicate(hash)) return
```

---

## 6. Performance Summary

| Operation | Cost | Impact |
|-----------|------|--------|
| isFocused() | ~0.01ms | Negligible |
| SHA256 hash | ~0.3ms | Negligible |
| Map lookup | O(1) | Negligible |

---

## Unresolved Questions

1. Should dedup TTL be configurable? (suggest: no, YAGNI)
2. Per-terminal or global dedup? (suggest: per-terminal prefix in hash)
3. Hash content? (suggest: terminalId + pattern type + first 100 chars)

---

## Sources

- Electron BrowserWindow docs: https://www.electronjs.org/docs/latest/api/browser-window
- Node.js crypto module: https://nodejs.org/api/crypto.html
