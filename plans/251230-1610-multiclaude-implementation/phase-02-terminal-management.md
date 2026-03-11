---
title: "Phase 2: Terminal Management"
status: pending
priority: P1
effort: 10h
---

# Phase 2: Terminal Management

> Context: [plan.md](./plan.md) | [Phase 1](./phase-01-project-setup.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-12-30 |
| Priority | P1 - Core Feature |
| Status | Pending |
| Effort | 10h |

## Objective
Implement multi-terminal system with node-pty backend and xterm.js frontend.

## Requirements
- R1: Spawn multiple PTY processes from main process
- R2: Stream PTY output to renderer via IPC
- R3: Render terminals with xterm.js (WebGL acceleration)
- R4: Support terminal resize (fit addon)
- R5: Handle terminal close/cleanup properly
- R6: Run `claude` command in each terminal

## Architecture

### Data Flow
```
User Input → xterm.js → IPC → node-pty → shell → claude
                                    ↓
User Display ← xterm.js ← IPC ← node-pty output
```

### Terminal Manager (Main Process)
```typescript
interface Terminal {
  id: string
  pty: IPty
  projectPath: string
  createdAt: Date
}

class TerminalManager {
  private terminals: Map<string, Terminal>

  create(projectPath: string): string  // returns terminal id
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  destroy(id: string): void
  destroyAll(): void
}
```

### IPC Channels
| Channel | Direction | Payload |
|---------|-----------|---------|
| `terminal:create` | renderer→main | `{ projectPath }` |
| `terminal:data` | renderer→main | `{ id, data }` |
| `terminal:resize` | renderer→main | `{ id, cols, rows }` |
| `terminal:close` | renderer→main | `{ id }` |
| `terminal:output` | main→renderer | `{ id, data }` |
| `terminal:exit` | main→renderer | `{ id, code }` |

## Implementation Steps

### Step 1: Install Dependencies (15m)
```bash
npm i @lydell/node-pty
npm i @xterm/xterm @xterm/addon-fit @xterm/addon-webgl
npm i -D @types/node
```

Note: Using `@lydell/node-pty` fork - better Electron compatibility.

### Step 2: Create Terminal Manager (2h)
`src/main/terminal/terminal-manager.ts`:
```typescript
import * as pty from '@lydell/node-pty'
import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'

interface ManagedTerminal {
  id: string
  pty: pty.IPty
  projectPath: string
}

export class TerminalManager {
  private terminals = new Map<string, ManagedTerminal>()
  private window: BrowserWindow | null = null

  setWindow(win: BrowserWindow) {
    this.window = win
  }

  create(projectPath: string): string {
    const id = randomUUID()
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash'

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: projectPath,
      env: process.env as Record<string, string>
    })

    ptyProcess.onData((data) => {
      this.window?.webContents.send('terminal:output', { id, data })
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.window?.webContents.send('terminal:exit', { id, code: exitCode })
      this.terminals.delete(id)
    })

    this.terminals.set(id, { id, pty: ptyProcess, projectPath })
    return id
  }

  write(id: string, data: string) {
    this.terminals.get(id)?.pty.write(data)
  }

  resize(id: string, cols: number, rows: number) {
    this.terminals.get(id)?.pty.resize(cols, rows)
  }

  destroy(id: string) {
    const terminal = this.terminals.get(id)
    if (terminal) {
      terminal.pty.kill()
      this.terminals.delete(id)
    }
  }

  destroyAll() {
    for (const [id] of this.terminals) {
      this.destroy(id)
    }
  }

  getAll(): string[] {
    return Array.from(this.terminals.keys())
  }
}

export const terminalManager = new TerminalManager()
```

### Step 3: Create IPC Handlers (1h)
`src/main/ipc/terminal-handlers.ts`:
```typescript
import { ipcMain } from 'electron'
import { terminalManager } from '../terminal/terminal-manager'

export function registerTerminalHandlers() {
  ipcMain.handle('terminal:create', (_, { projectPath }) => {
    return terminalManager.create(projectPath)
  })

  ipcMain.on('terminal:data', (_, { id, data }) => {
    terminalManager.write(id, data)
  })

  ipcMain.on('terminal:resize', (_, { id, cols, rows }) => {
    terminalManager.resize(id, cols, rows)
  })

  ipcMain.on('terminal:close', (_, { id }) => {
    terminalManager.destroy(id)
  })
}
```

Update `src/main/index.ts` to register handlers and set window.

### Step 4: Update Preload Script (30m)
`src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  terminal: {
    create: (projectPath: string) =>
      ipcRenderer.invoke('terminal:create', { projectPath }),
    write: (id: string, data: string) =>
      ipcRenderer.send('terminal:data', { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', { id, cols, rows }),
    close: (id: string) =>
      ipcRenderer.send('terminal:close', { id }),
    onOutput: (callback: (data: { id: string; data: string }) => void) => {
      const handler = (_: unknown, data: { id: string; data: string }) => callback(data)
      ipcRenderer.on('terminal:output', handler)
      return () => ipcRenderer.removeListener('terminal:output', handler)
    },
    onExit: (callback: (data: { id: string; code: number }) => void) => {
      const handler = (_: unknown, data: { id: string; code: number }) => callback(data)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    }
  }
})
```

### Step 5: Create Terminal Component (2h)
`src/renderer/components/terminal/Terminal.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'

interface Props {
  id: string
  onClose?: () => void
}

export function Terminal({ id, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const xterm = new XTerm({
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#eaeaea'
      },
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      fontSize: 14
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(containerRef.current)

    // Try WebGL, fallback to canvas
    try {
      xterm.loadAddon(new WebglAddon())
    } catch (e) {
      console.warn('WebGL not supported, using canvas')
    }

    fitAddon.fit()
    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      window.electronAPI.terminal.resize(id, xterm.cols, xterm.rows)
    })
    resizeObserver.observe(containerRef.current)

    // User input → PTY
    xterm.onData((data) => {
      window.electronAPI.terminal.write(id, data)
    })

    // PTY output → xterm
    const unsubOutput = window.electronAPI.terminal.onOutput(({ id: tid, data }) => {
      if (tid === id) xterm.write(data)
    })

    // Terminal exit
    const unsubExit = window.electronAPI.terminal.onExit(({ id: tid }) => {
      if (tid === id) onClose?.()
    })

    return () => {
      resizeObserver.disconnect()
      unsubOutput()
      unsubExit()
      xterm.dispose()
    }
  }, [id, onClose])

  return (
    <div className="h-full w-full bg-[#1a1a2e] rounded overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
```

### Step 6: Create Terminal Grid (1.5h)
`src/renderer/components/terminal/TerminalGrid.tsx`:
```tsx
import { useState } from 'react'
import { Terminal } from './Terminal'
import { useTerminalStore } from '../../stores/terminal-store'

export function TerminalGrid() {
  const { terminals, removeTerminal, addTerminal } = useTerminalStore()

  const gridClass = terminals.length <= 1
    ? ''
    : terminals.length <= 2
      ? 'grid-cols-2'
      : 'grid-cols-2 grid-rows-2'

  return (
    <div className={`h-full grid gap-2 ${gridClass}`}>
      {terminals.map(t => (
        <Terminal
          key={t.id}
          id={t.id}
          onClose={() => removeTerminal(t.id)}
        />
      ))}
      {terminals.length < 4 && (
        <button
          onClick={() => addTerminal()}
          className="border-2 border-dashed border-gray-600 rounded
                     flex items-center justify-center text-gray-400
                     hover:border-gray-500 hover:text-gray-300"
        >
          + Add Terminal
        </button>
      )}
    </div>
  )
}
```

### Step 7: Create Terminal Store (1h)
`src/renderer/stores/terminal-store.ts`:
```typescript
import { create } from 'zustand'

interface TerminalState {
  terminals: Array<{ id: string; projectPath: string }>
  addTerminal: (projectPath?: string) => Promise<void>
  removeTerminal: (id: string) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],

  addTerminal: async (projectPath = process.cwd()) => {
    const id = await window.electronAPI.terminal.create(projectPath)
    set(state => ({
      terminals: [...state.terminals, { id, projectPath }]
    }))

    // Auto-run claude command
    setTimeout(() => {
      window.electronAPI.terminal.write(id, 'claude\n')
    }, 500)
  },

  removeTerminal: (id) => {
    window.electronAPI.terminal.close(id)
    set(state => ({
      terminals: state.terminals.filter(t => t.id !== id)
    }))
  }
}))
```

### Step 8: Install Zustand & Type Declarations (30m)
```bash
npm i zustand
```

Add type declaration for `window.electronAPI` in `src/shared/types/electron.d.ts`.

### Step 9: Integration & Testing (1.5h)
1. Update `App.tsx` to include `TerminalGrid`
2. Add initial terminal creation on app start
3. Test multi-terminal functionality
4. Verify resize behavior
5. Test terminal close/cleanup

## Success Criteria
- [ ] Can create up to 4 terminals simultaneously
- [ ] Each terminal runs independent PTY process
- [ ] Terminal resize works correctly
- [ ] Input/output streams bidirectionally
- [ ] Closing terminal kills PTY process
- [ ] No memory leaks on terminal create/destroy
- [ ] Claude command runs in each terminal

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| node-pty native build fails | Medium | High | Use rebuild scripts, electron-rebuild |
| xterm.js memory leaks | Medium | Medium | Proper dispose() calls in cleanup |
| IPC bottleneck with many terminals | Low | Medium | Batch output if needed |
| WebGL not available | Low | Low | Auto-fallback to canvas renderer |

## Deliverables
1. Working multi-terminal system
2. Terminal manager in main process
3. xterm.js components in renderer
4. Zustand store for terminal state
5. Ready for Phase 3 Git integration
