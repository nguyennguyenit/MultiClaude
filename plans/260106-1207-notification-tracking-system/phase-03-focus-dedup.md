# Phase 3: Focus Detection & Deduplication

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Depends On:** Phase 1 (Types & Constants)
- **Research:** [Focus Detection & Dedup](./research/researcher-02-focus-detection-dedup.md)

## Overview

- **Priority:** P2
- **Status:** Done
- **Description:** Implement focus detection and unique task ID deduplication to prevent notification spam

## Key Insights

- `BrowserWindow.isFocused()` for window focus state
- `window.on('focus')` / `window.on('blur')` for event-based tracking
- Active terminal ID sent from renderer via IPC
- SHA256 hash truncated to 16 chars sufficient for dedup
- Map-based storage with 5-minute TTL per task

## Requirements

- FocusDetector: track window focus + active terminal
- TaskTracker: deduplicate via unique task IDs
- IPC handler for active terminal updates from renderer

## Related Code Files

**Create:**
- `src/main/notification/focus-detector.ts`
- `src/main/notification/task-tracker.ts`

**Modify:**
- `src/main/ipc/handlers.ts` - add IPC for active terminal
- `src/shared/constants/ipc-channels.ts` - add channel constant

## Implementation Steps

### 1. Create `src/main/notification/focus-detector.ts`

```typescript
import { BrowserWindow } from 'electron'

export class FocusDetector {
  private window: BrowserWindow | null = null
  private windowFocused = true
  private activeTerminalId: string | null = null

  setWindow(window: BrowserWindow): void {
    this.window = window
    this.windowFocused = window.isFocused()

    window.on('focus', () => {
      this.windowFocused = true
    })

    window.on('blur', () => {
      this.windowFocused = false
    })
  }

  setActiveTerminal(terminalId: string | null): void {
    this.activeTerminalId = terminalId
  }

  /**
   * Determine if notification should be sent
   * Returns true if: window unfocused OR different terminal is active
   */
  shouldNotify(terminalId: string): boolean {
    // Always notify if window is not focused
    if (!this.windowFocused) {
      return true
    }

    // Notify if a different terminal is active
    if (this.activeTerminalId !== terminalId) {
      return true
    }

    // User is looking at this terminal - don't notify
    return false
  }

  isWindowFocused(): boolean {
    return this.windowFocused
  }

  getActiveTerminalId(): string | null {
    return this.activeTerminalId
  }

  destroy(): void {
    this.window = null
  }
}
```

### 2. Create `src/main/notification/task-tracker.ts`

```typescript
export class TaskTracker {
  private seenTasks: Map<string, Set<string>> = new Map()  // terminalId -> Set<taskId>
  private timestamps: Map<string, number> = new Map()      // taskId -> timestamp
  private ttlMs = 5 * 60 * 1000  // 5 minutes

  /**
   * Check if task should trigger notification
   * Returns true if task hasn't been seen recently
   */
  shouldNotify(terminalId: string, taskId: string): boolean {
    const now = Date.now()

    // Check if we've seen this exact task recently
    const lastSeen = this.timestamps.get(taskId)
    if (lastSeen && now - lastSeen < this.ttlMs) {
      return false  // Still within cooldown
    }

    // Track this task
    const terminalTasks = this.seenTasks.get(terminalId) || new Set()
    terminalTasks.add(taskId)
    this.seenTasks.set(terminalId, terminalTasks)
    this.timestamps.set(taskId, now)

    return true
  }

  /**
   * Clear tracking for a specific terminal (on terminal destroy/project switch)
   */
  clearTerminal(terminalId: string): void {
    const tasks = this.seenTasks.get(terminalId)
    if (tasks) {
      for (const taskId of tasks) {
        this.timestamps.delete(taskId)
      }
      this.seenTasks.delete(terminalId)
    }
  }

  /**
   * Clear all tracking (on app restart)
   */
  clearAll(): void {
    this.seenTasks.clear()
    this.timestamps.clear()
  }

  /**
   * Periodic cleanup of stale entries
   */
  cleanup(): void {
    const now = Date.now()

    // Remove stale timestamps
    for (const [taskId, timestamp] of this.timestamps) {
      if (now - timestamp > this.ttlMs) {
        this.timestamps.delete(taskId)

        // Remove from terminal sets
        for (const [, tasks] of this.seenTasks) {
          tasks.delete(taskId)
        }
      }
    }

    // Remove empty terminal entries
    for (const [terminalId, tasks] of this.seenTasks) {
      if (tasks.size === 0) {
        this.seenTasks.delete(terminalId)
      }
    }
  }

  /**
   * Get stats for debugging
   */
  getStats(): { terminals: number; tasks: number } {
    return {
      terminals: this.seenTasks.size,
      tasks: this.timestamps.size
    }
  }
}
```

### 3. Add IPC channel in `src/shared/constants/ipc-channels.ts`

```typescript
// Add to existing channels
NOTIFICATION_SET_ACTIVE_TERMINAL: 'notification:set-active-terminal',
```

### 4. Add IPC handler in `src/main/ipc/handlers.ts`

```typescript
// Add handler for active terminal updates
ipcMain.on(IPC_CHANNELS.NOTIFICATION_SET_ACTIVE_TERMINAL, (_, terminalId: string | null) => {
  notificationManager.setActiveTerminal(terminalId)
})
```

### 5. Add preload exposure in `src/preload/index.ts`

```typescript
// In notification namespace
setActiveTerminal: (terminalId: string | null) => {
  ipcRenderer.send('notification:set-active-terminal', terminalId)
}
```

## Todo List

- [x] Create focus-detector.ts with window/terminal tracking
- [x] Create task-tracker.ts with unique ID deduplication
- [x] Add IPC_CHANNELS.NOTIFICATION_SET_ACTIVE_TERMINAL
- [x] Add IPC handler for active terminal updates
- [x] Add preload exposure for setActiveTerminal
- [x] Export from notification/index.ts
- [x] Unit test: FocusDetector.shouldNotify() logic
- [x] Unit test: TaskTracker.shouldNotify() deduplication

## Success Criteria

- [x] FocusDetector correctly tracks window focus state
- [x] FocusDetector.shouldNotify() returns false when user is watching terminal
- [x] TaskTracker prevents duplicate notifications for same task
- [x] TaskTracker.cleanup() removes stale entries
- [x] Active terminal updates flow from renderer to main process

## Risk Assessment

- **Low:** Linux/Wayland focus detection may be unreliable
- **Mitigation:** `notifyOnlyBackground` setting can be disabled by user

## Security Considerations

- None for this phase (internal tracking only)

## Next Steps

→ Phase 4: NotificationManager Integration
