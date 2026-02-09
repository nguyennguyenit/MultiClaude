---
title: "Phase 1: Project Setup"
status: pending
priority: P1
effort: 4h
---

# Phase 1: Project Setup

> Context: [plan.md](./plan.md) | [tech-stack.md](../../docs/tech-stack.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-12-30 |
| Priority | P1 - Critical Path |
| Status | Pending |
| Effort | 4h |

## Objective
Scaffold Electron + React + Vite + TypeScript project with proper structure for terminal app.

## Requirements
- R1: Electron 33 with context isolation enabled
- R2: React 19 with TypeScript 5.x
- R3: Vite 6 for fast HMR during development
- R4: Tailwind CSS 4 configured
- R5: Proper main/renderer/preload separation
- R6: Hot reload works for both main and renderer

## Architecture

### Project Structure
```
multiclaude/
├── src/
│   ├── main/
│   │   └── index.ts          # Electron main entry
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx          # React entry
│   │   ├── App.tsx
│   │   └── index.css         # Tailwind
│   ├── preload/
│   │   └── index.ts          # Context bridge
│   └── shared/
│       └── types/
│           └── index.ts      # Shared types
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

### Build Tool Choice
Using `electron-vite` - handles main/renderer/preload builds with single config.

## Implementation Steps

### Step 1: Initialize Project (30m)
```bash
mkdir multiclaude && cd multiclaude
npm init -y
npm i electron@33 react@19 react-dom@19
npm i -D typescript @types/react @types/react-dom
npm i -D electron-vite vite
npm i -D tailwindcss postcss autoprefixer
```

### Step 2: Configure TypeScript (20m)
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

Create `tsconfig.node.json` for main process (Node target).
Create `tsconfig.web.json` for renderer (DOM types).

### Step 3: Configure electron-vite (30m)
Create `electron.vite.config.ts`:
```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()]
  }
})
```

### Step 4: Create Main Process Entry (30m)
`src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron'
import path from 'path'

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

### Step 5: Create Preload Script (20m)
`src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Terminal APIs will be added in Phase 2
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    return () => ipcRenderer.removeAllListeners(channel)
  }
})
```

### Step 6: Create React App Shell (40m)
`src/renderer/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="h-screen bg-gray-900 text-white flex">
      <aside className="w-64 bg-gray-800 p-4">
        <h1 className="text-xl font-bold">MultiClaude</h1>
        {/* Sidebar - Phase 4 */}
      </aside>
      <main className="flex-1 p-4">
        {/* Terminal grid - Phase 2 */}
        <p className="text-gray-400">Terminals will appear here</p>
      </main>
    </div>
  )
}
```

### Step 7: Configure Tailwind (20m)
`tailwind.config.js`:
```js
export default {
  content: ['./src/renderer/**/*.{html,tsx}'],
  theme: { extend: {} },
  plugins: []
}
```

`src/renderer/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 8: Add npm Scripts (10m)
```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  }
}
```

### Step 9: Test Setup (20m)
```bash
npm run dev
# Verify: Window opens, React renders, Tailwind styles work
```

## Success Criteria
- [ ] `npm run dev` launches Electron window
- [ ] React app renders with Tailwind styling
- [ ] Hot reload works for renderer changes
- [ ] Main process restarts on changes
- [ ] DevTools accessible in dev mode
- [ ] No console errors

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| electron-vite config issues | Low | Medium | Use official template as reference |
| Tailwind v4 breaking changes | Low | Low | Fallback to v3 if needed |
| TypeScript path resolution | Medium | Low | Use baseUrl + paths in tsconfig |

## Deliverables
1. Working Electron + React dev environment
2. Proper project structure matching tech-stack.md
3. Ready for Phase 2 terminal integration
