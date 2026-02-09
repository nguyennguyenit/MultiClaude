# Phase 1: Modal Container

## Context

- Plan: `plans/260104-0431-ui-redesign-phase4-settings-modal/plan.md`
- Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 345-375)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 1h

Create modal container with backdrop, header, sidebar navigation, content area, and footer.

## Requirements

### Functional
- Modal overlay with dark backdrop (click outside to close optional)
- ESC key to close
- Header: "Settings" title + close button
- Left sidebar: Tab navigation (Appearance, Terminals, Notifications)
- Right content: Dynamic based on active tab
- Footer: Cancel + Save Settings buttons

### Design
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                 ✕  │
│  App Settings                                                   │
├────────────────────────┬────────────────────────────────────────┤
│                        │                                        │
│  🎨 Appearance     ◀   │                                        │
│                        │         (Content Area)                 │
│  📟 Terminals          │                                        │
│                        │                                        │
│  🔔 Notifications      │                                        │
│                        │                                        │
├────────────────────────┴────────────────────────────────────────┤
│                                     [ Cancel ]  [ 💾 Save ]     │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

```tsx
interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'appearance' | 'terminals' | 'notifications'
```

## Related Code Files

### Create
| File | Purpose |
|------|---------|
| `src/renderer/components/settings/settings-modal.tsx` | Modal container |
| `src/renderer/components/settings/settings-sidebar.tsx` | Tab navigation |

### Modify
| File | Changes |
|------|---------|
| `src/renderer/stores/settings-store.ts` | Add settingsModalOpen state |
| `src/renderer/components/settings/index.ts` | Export new components |

## Implementation Steps

### Step 1: Add Modal State to Store

```tsx
// settings-store.ts - add to interface
settingsModalOpen: boolean
setSettingsModalOpen: (open: boolean) => void

// add to store
settingsModalOpen: false,
setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
```

### Step 2: Create Settings Sidebar

```tsx
// src/renderer/components/settings/settings-sidebar.tsx
type SettingsTab = 'appearance' | 'terminals' | 'notifications'

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

const tabs = [
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'terminals', label: 'Terminals', icon: '📟' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' }
]

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <div className="w-48 border-r border-[var(--mc-border)] p-2">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id as SettingsTab)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left
            ${activeTab === tab.id
              ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
              : 'hover:bg-[var(--mc-bg-hover)]'}`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
          {activeTab === tab.id && <span className="ml-auto">◀</span>}
        </button>
      ))}
    </div>
  )
}
```

### Step 3: Create Settings Modal

```tsx
// src/renderer/components/settings/settings-modal.tsx
import { useState, useEffect } from 'react'
import { SettingsSidebar } from './settings-sidebar'
import { ThemeSelector } from './theme-selector'
import { TerminalSettings } from './terminal-settings'
import { NotificationSettings } from './notification-settings'

type SettingsTab = 'appearance' | 'terminals' | 'notifications'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--mc-bg-primary)] rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--mc-border)]">
          <div>
            <h2 className="text-lg font-semibold">⚙️ Settings</h2>
            <p className="text-sm text-[var(--mc-text-muted)]">App Settings</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[var(--mc-bg-hover)] rounded">✕</button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 p-4 overflow-auto">
            {activeTab === 'appearance' && <ThemeSelector />}
            {activeTab === 'terminals' && <TerminalSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--mc-border)]">
          <button onClick={onClose} className="px-4 py-2 rounded bg-[var(--mc-bg-hover)]">
            Cancel
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]">
            💾 Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
```

## Todo List

- [ ] Add settingsModalOpen state to settings-store.ts
- [ ] Create settings-sidebar.tsx
- [ ] Create settings-modal.tsx with layout
- [ ] Add ESC key handler
- [ ] Add backdrop click to close
- [ ] Style modal per design spec
- [ ] Update exports in index.ts
- [ ] Test modal open/close

## Success Criteria

- [ ] Modal opens/closes correctly
- [ ] ESC key closes modal
- [ ] Tab navigation works
- [ ] Content area shows correct tab content
- [ ] Footer buttons work
- [ ] Matches design spec layout

## Next Steps

Proceed to Phase 2: Appearance Tab
