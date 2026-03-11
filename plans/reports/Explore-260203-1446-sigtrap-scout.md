# Scout Report: SIGTRAP Crash Analysis
**Date:** 2026-02-03  
**Project:** MultiClaude v1.1.8  
**Focus:** SIGTRAP crash investigation

---

## Executive Summary

**Status:** ✅ **SIGTRAP CRASH FIXED** (Commit `bca6730`, Jan 10 2026)

The codebase contains a **resolved** SIGTRAP crash that was caused by improper Electron process termination during app updates. The fix ensures graceful terminal cleanup before exit.

---

## Project Overview

**Type:** Electron desktop app (multi-agent terminal manager for Claude Code)  
**Tech Stack:**
- **Runtime:** Electron 33 + Node.js  
- **Language:** TypeScript + React 19  
- **Terminal:** @lydell/node-pty v1.1.0 (native module)  
- **Git:** simple-git  
- **State:** Zustand  
- **Updates:** electron-updater  

**Entry Point:** `/src/main/index.ts` (Electron main process)

---

## SIGTRAP Root Cause

### Problem Identified
**Commit:** `bca6730` (Sat Jan 10 2026)  
**Issue:** `autoUpdater.quitAndInstall(false, true)` in updater causing **SIGTRAP signal**

### Why SIGTRAP Occurred
- `quitAndInstall()` bypasses normal app cleanup (window-all-closed event)
- Terminal PTY processes (@lydell/node-pty) were **not destroyed** before exit
- Node-pty's native child processes trapped on signal (SIGTRAP = Signal Trap)
- Related to improper cleanup of child processes in graceful vs force exit scenarios

### The Fix (Applied)
```typescript
// Before (crash):
export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)  // ❌ Bypasses cleanup
}

// After (fixed):
export function installUpdate(): void {
  // Use app.quit() instead of quitAndInstall() to trigger normal quit flow
  // This ensures terminal cleanup (destroyAllAsync) runs before exit
  // autoInstallOnAppQuit = true (line 8) handles update installation after quit
  app.quit()  // ✅ Triggers window-all-closed → destroyAllAsync()
}
```

**Location:** `/src/main/updater/auto-updater.ts:153-158`

---

## Terminal Cleanup Architecture

MultiClaude implements **async terminal destruction** to prevent SIGTRAP:

### Graceful Shutdown Flow
```
app.quit()
  ↓
app.on('window-all-closed')  // Triggered by quit()
  ↓
terminalManager.destroyAllAsync()
  ├─ For each terminal:
  │  ├─ Attach onExit listener
  │  ├─ Send graceful kill (SIGTERM via pty.kill())
  │  └─ Force kill after 3s timeout (SIGKILL on Unix)
  ↓
gitHeadWatcher.destroy()
notificationManager.destroy()
  ↓
app.quit() completes → OS allows clean exit
```

**Key Code:** `/src/main/index.ts:121-133`  
**Terminal Manager:** `/src/main/terminal/terminal-manager.ts:234-268` (destroyAsync)

---

## Native Module Analysis

### Node-PTY Usage
- **Package:** @lydell/node-pty v1.1.0 (fork of node-pty with better support)
- **Native Binding:** Unix PTY syscalls (forkpty) + Windows ConPTY
- **Exposed via Rollup:** Marked as external in vite.config.ts line 29
- **No Breakpoints/Debug Code:** No debug symbols left in shipped code

### No Other Native Modules
- simple-git: Pure JS wrapper
- electron-store: Pure JS
- No native V8 debugging, no debug assertions

---

## Recent Changes (Last 20 Commits)

| Commit | Change | Impact |
|--------|--------|--------|
| ea8c0d8 | Merge PR #18 (beta) | Latest master |
| 7871435 | v1.1.8 bump | Version release |
| 286f131 | IPA docs update | Docs only |
| c57546b | IPA modular skills | Skills architecture |
| bca6730 | **SIGTRAP FIX** | Terminal cleanup |
| 6c87229 | electron-updater init | Introduced updater |

---

## Architecture Summary

```
Electron Main Process (src/main/index.ts)
├─ TerminalManager (node-pty wrapper)
│  ├─ create() → spawn PTY process
│  ├─ write() → send input
│  ├─ destroyAsync() → graceful + force kill [SIGTRAP FIX]
│  └─ signals: output, exit, titleChange
├─ GitManager (simple-git)
├─ ProjectStore (persistence)
├─ SettingsStore (app config)
├─ NotificationManager (Telegram/Discord)
└─ IPC Handlers (Renderer ↔ Main)
    ├─ Terminal operations (create, destroy, resize, input)
    ├─ Git operations (status, commit, push, etc.)
    └─ Update handling
```

---

## Signal Handling Summary

### Process Signals
- ✅ `uncaughtException` handler present (line 136-139)
- ✅ `SIGTRAP` prevented by proper cleanup sequence
- ✅ Terminal processes gracefully killed before app exit
- ❌ No other signal handlers (normal for Electron apps)

### Why SIGTRAP Not Needed
- V8 debugger not active in production
- No debug assertions in code
- Proper cleanup prevents signal trapping

---

## Build & Distribution

**Build Command:** `npm run build` → tsc + vite + electron-builder  
**Vite Config Safe:**
- Sourcemaps only in dev (line 25)
- External dependencies properly marked (line 29)
- No debug flags enabled

**Distribution Targets:**
- Linux: AppImage + deb
- macOS: dmg
- Windows: NSIS installer

---

## Deployment Status

**Current Release:** v1.1.8 (2026-01-23)  
**Fix Included:** ✅ YES (merged from beta branch Jan 10)  
**All Branches:** master, origin/beta, origin/release/v1.1.7 contain fix

---

## Remaining Questions

None. SIGTRAP crash fully understood and fixed.

---

## Files Reviewed

- `/src/main/index.ts` - Main process, window lifecycle
- `/src/main/updater/auto-updater.ts` - Update handler (fix location)
- `/src/main/terminal/terminal-manager.ts` - PTY management
- `/src/main/ipc/handlers.ts` - IPC message routing
- `/vite.config.ts` - Build configuration
- `package.json` - Dependencies (node-pty v1.1.0)
- Git history: 20 commits analyzed

---

## Conclusion

**SIGTRAP crash: RESOLVED**

The app properly implements graceful terminal shutdown to prevent signal trapping during app updates. Current codebase (v1.1.8) includes the fix and should run without SIGTRAP crashes.
