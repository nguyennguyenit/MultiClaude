# Phase 3: Renderer Store and UI

## Context

Create Zustand store for update state and UI component for Settings panel. Add badge notification when update available.

## Overview

Build update-store following notification-store pattern, create update-settings.tsx component with version display, check button, progress bar, and changelog. Add badge to sidebar Settings button.

## Requirements

- Zustand store with IPC listener for state changes
- Update Settings tab with all UI states (idle, checking, available, downloading, ready, error)
- Progress bar for downloads
- Plain text changelog (no markdown rendering)
- Badge dot on Settings button when update available
- Badge on Updates tab in settings sidebar

## Architecture

```
src/renderer/
  stores/
    update-store.ts      <- NEW: Zustand store
    index.ts             <- MODIFY: export store
  components/
    settings/
      update-settings.tsx   <- NEW: UI component
      settings-panel.tsx    <- MODIFY: add updates tab
    sidebar/
      sidebar.tsx           <- MODIFY: add badge
```

## Implementation Steps

### 1. Create `src/renderer/stores/update-store.ts`

```typescript
import { create } from 'zustand'
import type { UpdateState, UpdateStatus } from '@shared/types'

interface UpdateStore {
  state: UpdateState
  isLoading: boolean
  loadState: () => Promise<void>
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
}

const DEFAULT_STATE: UpdateState = {
  status: 'idle',
  currentVersion: '',
  latestVersion: null,
  releaseNotes: null,
  downloadProgress: 0,
  error: null
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  state: DEFAULT_STATE,
  isLoading: false,

  loadState: async () => {
    set({ isLoading: true })
    try {
      const state = await window.electron.update.getState()
      set({ state, isLoading: false })
    } catch (error) {
      console.error('Failed to load update state:', error)
      set({ isLoading: false })
    }
  },

  checkForUpdates: async () => {
    try {
      const state = await window.electron.update.check()
      set({ state })
    } catch (error) {
      console.error('Failed to check for updates:', error)
    }
  },

  downloadUpdate: async () => {
    try {
      await window.electron.update.download()
    } catch (error) {
      console.error('Failed to download update:', error)
    }
  },

  installUpdate: async () => {
    try {
      await window.electron.update.install()
    } catch (error) {
      console.error('Failed to install update:', error)
    }
  }
}))

// Setup IPC listener - call once in App
export function setupUpdateListener(): () => void {
  const handleStateChange = (state: UpdateState) => {
    useUpdateStore.setState({ state })
  }

  return window.electron.update.onStatusChanged(handleStateChange)
}
```

### 2. Modify `src/renderer/stores/index.ts`

Add export:
```typescript
export { useUpdateStore, setupUpdateListener } from './update-store'
```

### 3. Create `src/renderer/components/settings/update-settings.tsx`

```typescript
import { useEffect } from 'react'
import { useUpdateStore } from '../../stores'

export function UpdateSettings() {
  const { state, isLoading, loadState, checkForUpdates, downloadUpdate, installUpdate } = useUpdateStore()
  const { status, currentVersion, latestVersion, releaseNotes, downloadProgress, error } = state

  useEffect(() => {
    loadState()
  }, [loadState])

  return (
    <div className="space-y-4">
      {/* Current Version */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--mc-text-secondary)]">Current Version</span>
        <span className="text-sm font-medium text-[var(--mc-text-primary)]">
          {currentVersion || 'Loading...'}
        </span>
      </div>

      {/* Check Button */}
      <button
        onClick={checkForUpdates}
        disabled={status === 'checking' || status === 'downloading'}
        className={`
          w-full px-3 py-2 text-sm rounded
          ${status === 'checking' || status === 'downloading'
            ? 'bg-[var(--mc-bg-hover)] text-[var(--mc-text-muted)] cursor-not-allowed'
            : 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90'
          }
        `}
      >
        {status === 'checking' ? 'Checking...' : 'Check for Updates'}
      </button>

      {/* Status Messages */}
      {status === 'idle' && !latestVersion && (
        <p className="text-xs text-[var(--mc-text-muted)]">
          You're up to date.
        </p>
      )}

      {status === 'error' && error && (
        <p className="text-xs text-red-500">
          Error: {error}
        </p>
      )}

      {/* Update Available */}
      {(status === 'available' || status === 'downloading' || status === 'ready') && latestVersion && (
        <div className="border border-[var(--mc-border)] rounded p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
            <span className="text-sm font-medium text-[var(--mc-text-primary)]">
              Version {latestVersion} available
            </span>
          </div>

          {/* Release Notes */}
          {releaseNotes && (
            <div className="space-y-1">
              <span className="text-xs text-[var(--mc-text-muted)]">What's New</span>
              <pre className="text-xs text-[var(--mc-text-secondary)] whitespace-pre-wrap max-h-32 overflow-y-auto bg-[var(--mc-bg-tertiary)] p-2 rounded">
                {releaseNotes}
              </pre>
            </div>
          )}

          {/* Download Progress */}
          {status === 'downloading' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[var(--mc-text-muted)]">
                <span>Downloading...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 bg-[var(--mc-bg-tertiary)] rounded overflow-hidden">
                <div
                  className="h-full bg-[var(--mc-accent)] transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          {status === 'available' && (
            <button
              onClick={downloadUpdate}
              className="w-full px-3 py-2 text-sm rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90"
            >
              Download Update
            </button>
          )}

          {status === 'ready' && (
            <button
              onClick={installUpdate}
              className="w-full px-3 py-2 text-sm rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90"
            >
              Install and Restart
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

### 4. Modify `src/renderer/components/settings/settings-panel.tsx`

Add import:
```typescript
import { UpdateSettings } from './update-settings'
import { useUpdateStore } from '../../stores'
```

Update SettingsTab type:
```typescript
type SettingsTab = 'appearance' | 'terminals' | 'notifications' | 'updates'
```

Add badge state inside component:
```typescript
const { state: updateState } = useUpdateStore()
const hasUpdate = updateState.status === 'available' || updateState.status === 'ready'
```

Add tab button (after Notifications):
```typescript
<TabButton
  active={activeTab === 'updates'}
  onClick={() => setActiveTab('updates')}
  badge={hasUpdate}
>
  Updates
</TabButton>
```

Add tab content (after notifications):
```typescript
{activeTab === 'updates' && <UpdateSettings />}
```

Update TabButton to support badge:
```typescript
function TabButton({
  children,
  active,
  onClick,
  badge
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  badge?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1 text-xs rounded relative
        ${active
          ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
          : 'bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-active)]'
        }
      `}
    >
      {children}
      {badge && !active && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
      )}
    </button>
  )
}
```

### 5. Modify `src/renderer/components/sidebar/sidebar.tsx`

Add import:
```typescript
import { useUpdateStore } from '../../stores'
```

Add inside Sidebar component:
```typescript
const { state: updateState } = useUpdateStore()
const hasUpdate = updateState.status === 'available' || updateState.status === 'ready'
```

Update Settings button to include badge (wrap the button content):
```typescript
<button
  onClick={() => setSettingsModalOpen(true)}
  className={`
    w-full flex items-center gap-2 px-2 py-2 rounded text-sm relative
    transition-colors duration-150
    ${sidebarCollapsed ? 'justify-center' : ''}
    hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)]
  `}
>
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
  {!sidebarCollapsed && <span className="whitespace-nowrap">Settings</span>}
  {hasUpdate && (
    <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
  )}
</button>
```

### 6. Setup listener in App.tsx

Add import:
```typescript
import { setupUpdateListener } from './stores'
```

Add useEffect in App component:
```typescript
useEffect(() => {
  const cleanupUpdate = setupUpdateListener()
  return () => {
    cleanupUpdate()
  }
}, [])
```

## Todo

- [ ] Create `src/renderer/stores/update-store.ts`
- [ ] Export from `src/renderer/stores/index.ts`
- [ ] Create `src/renderer/components/settings/update-settings.tsx`
- [ ] Add UpdateSettings import to settings-panel.tsx
- [ ] Add 'updates' to SettingsTab type
- [ ] Add badge prop to TabButton
- [ ] Add Updates tab button and content
- [ ] Import useUpdateStore in sidebar.tsx
- [ ] Add hasUpdate check to Sidebar
- [ ] Add badge dot to Settings button
- [ ] Add setupUpdateListener to App.tsx
- [ ] Test all UI states: idle, checking, available, downloading, ready, error
- [ ] Test badge visibility on sidebar and settings tab

## Success Criteria

- [ ] Updates tab visible in Settings panel
- [ ] Current version displays correctly
- [ ] "Check for Updates" works, shows loading state
- [ ] "Update available" shows version and changelog
- [ ] Download progress bar animates 0-100%
- [ ] "Install and Restart" triggers restart
- [ ] Error states display properly
- [ ] Badge appears on Settings button when update available
- [ ] Badge appears on Updates tab when update available
- [ ] No TypeScript errors
- [ ] UI follows existing design patterns
