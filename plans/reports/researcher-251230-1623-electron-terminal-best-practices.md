# Electron + React + TypeScript Terminal App Research Report

**Date:** 2025-12-30 | **Project:** MultiClaude

---

## 1. node-pty Integration Best Practices

### Key Findings
- Run node-pty in **main process only** (not renderer) for security
- Not thread-safe; avoid multi-threaded usage
- Spawned processes inherit parent permissions - consider privilege restrictions
- Provides raw UTF-8 byte streams; handles terminal size via `resize(cols, rows)`

### Recommended Pattern
```typescript
// main/ptyManager.ts
import { spawn, IPty } from 'node-pty';

interface PtySession {
  id: string;
  pty: IPty;
  cwd: string;
}

const sessions = new Map<string, PtySession>();

export function createPty(id: string, cwd: string, shell: string): void {
  const pty = spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: process.env as Record<string, string>
  });
  sessions.set(id, { id, pty, cwd });
}
```

---

## 2. xterm.js Setup for React

### Key Findings
- Use hooks-based lifecycle management (`useRef`, `useEffect`)
- Essential addons: `@xterm/addon-fit`, `@xterm/addon-web-links`, `@xterm/addon-search`
- Cleanup critical: dispose terminal + remove listeners to prevent memory leaks
- Canvas rendering preferred for high-throughput scenarios

### Recommended Component
```typescript
// renderer/components/Terminal.tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  sessionId: string;
  onData: (data: string) => void;
}

export function TerminalView({ sessionId, onData }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({ cursorBlink: true });
    const fitAddon = new FitAddon();

    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    term.onData(onData);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [sessionId, onData]);

  return <div ref={containerRef} style={{ height: '100%' }} />;
}
```

---

## 3. IPC Communication Patterns

### Key Findings
- Use `contextIsolation: true` + `nodeIntegration: false` (mandatory)
- Preload script exposes safe API via `contextBridge`
- Async IPC preferred (`invoke/handle`) over sync
- Data flow: renderer -> preload -> main -> node-pty -> main -> renderer

### Recommended Architecture
```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('terminalAPI', {
  createSession: (id: string, cwd: string) =>
    ipcRenderer.invoke('pty:create', id, cwd),
  write: (id: string, data: string) =>
    ipcRenderer.send('pty:write', id, data),
  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', id, cols, rows),
  onData: (callback: (id: string, data: string) => void) =>
    ipcRenderer.on('pty:data', (_, id, data) => callback(id, data)),
  destroySession: (id: string) =>
    ipcRenderer.invoke('pty:destroy', id)
});

// main.ts - IPC handlers
ipcMain.handle('pty:create', (_, id, cwd) => createPty(id, cwd, shell));
ipcMain.on('pty:write', (_, id, data) => sessions.get(id)?.pty.write(data));
ipcMain.on('pty:resize', (_, id, cols, rows) => sessions.get(id)?.pty.resize(cols, rows));
```

---

## 4. Multi-Terminal Management Patterns

### Key Findings
- Centralized session registry in main process
- Each session = unique ID + pty instance + metadata
- UI patterns: tabbed interface, split panes
- State sync via IPC between main and renderer

### Recommended State Structure
```typescript
// types/terminal.ts
interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  isActive: boolean;
}

// renderer - Zustand store recommended
import { create } from 'zustand';

interface TerminalStore {
  sessions: TerminalSession[];
  activeId: string | null;
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActive: (id: string) => void;
}
```

### Tab Management Pattern
```
+--[Tab1]--[Tab2]--[Tab3]--[+]--+
|                               |
|     xterm.js instance         |
|     (connected to pty #N)     |
|                               |
+-------------------------------+
```

---

## 5. Session Persistence Strategies

### Key Findings
- `electron-store` for JSON-based config persistence
- Store in `app.getPath('userData')` directory
- Large scrollback buffers -> separate files, store paths only
- Restore on app startup via IPC

### Recommended Persistence Schema
```typescript
// main/store.ts
import Store from 'electron-store';

interface SessionConfig {
  id: string;
  cwd: string;
  title: string;
  env?: Record<string, string>;
}

interface AppConfig {
  sessions: SessionConfig[];
  activeSessionId: string | null;
  theme: 'dark' | 'light';
  fontSize: number;
}

const store = new Store<AppConfig>({
  defaults: {
    sessions: [],
    activeSessionId: null,
    theme: 'dark',
    fontSize: 14
  }
});

// Save on session change
export const saveSessions = (sessions: SessionConfig[]) =>
  store.set('sessions', sessions);

// Restore on startup
export const loadSessions = () => store.get('sessions');
```

---

## Recommendations for MultiClaude

### Architecture Summary
```
+------------------+     IPC      +------------------+
|   Main Process   |<------------>|  Renderer (React)|
|------------------|              |------------------|
| - node-pty mgr   |              | - xterm.js views |
| - electron-store |              | - Zustand store  |
| - IPC handlers   |              | - Tab UI         |
+------------------+              +------------------+
```

### Tech Stack
| Layer | Technology |
|-------|------------|
| Framework | Electron 28+ |
| Frontend | React 18 + TypeScript |
| Terminal | xterm.js 5.x + addons |
| PTY | node-pty |
| State | Zustand (renderer), Map (main) |
| Persistence | electron-store |
| Build | Vite + electron-builder |

### Critical Security Checklist
- [ ] `contextIsolation: true`
- [ ] `nodeIntegration: false`
- [ ] `sandbox: true`
- [ ] Validate all IPC inputs
- [ ] CSP headers configured

### Suggested Project Structure
```
src/
  main/
    index.ts          # Entry, window creation
    ptyManager.ts     # node-pty session management
    ipcHandlers.ts    # IPC handler registration
    store.ts          # electron-store config
  preload/
    index.ts          # contextBridge API
  renderer/
    App.tsx
    components/
      Terminal.tsx    # xterm wrapper
      TabBar.tsx      # Tab management
    store/
      terminalStore.ts
    types/
      index.ts
```

---

## Unresolved Questions
1. Should Claude Code sessions be launched as child processes of node-pty or via separate spawning mechanism?
2. Scrollback buffer size limits for memory management?
3. Need for WebSocket layer vs direct IPC for terminal data streaming?
