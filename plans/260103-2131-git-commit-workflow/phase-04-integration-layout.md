# Phase 4: Integration & Layout

## Overview

Integrate GitPanel into main App layout, add state persistence, coordinate with sidebar.

**Status:** Pending
**Effort:** 1h
**Priority:** P1 (Depends on Phase 3)

## Context Links

- [Main Plan](./plan.md)
- [Phase 3](./phase-03-frontend-git-panel.md)
- App layout: `src/renderer/App.tsx`
- Sidebar: `src/renderer/components/sidebar/sidebar.tsx`

## Requirements

1. Add GitPanel to App layout (right of terminal grid)
2. Store panel open/closed state in settings
3. Coordinate with sidebar Git section (show panel toggle there too)
4. Ensure responsive behavior

## Related Code Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/renderer/App.tsx` | Add GitPanel to layout |
| Modify | `src/renderer/stores/settings-store.ts` | Add gitPanelOpen state |
| Modify | `src/renderer/components/sidebar/sidebar.tsx` | Add panel toggle button |

## Implementation Steps

### Step 1: Update Settings Store (src/renderer/stores/settings-store.ts)

Add to interface and store:

```typescript
interface SettingsState {
  settings: AppSettings
  gitPanelOpen: boolean  // NEW
  loadSettings: () => Promise<void>
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>
  setGitPanelOpen: (open: boolean) => void  // NEW
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    themeMode: 'system',
    colorTheme: 'default'
  },
  gitPanelOpen: false,  // NEW - default closed

  loadSettings: async () => { /* existing */ },
  updateSettings: async (newSettings) => { /* existing */ },

  // NEW
  setGitPanelOpen: (open) => set({ gitPanelOpen: open })
}))
```

### Step 2: Update App.tsx Layout

Import and add GitPanel:

```typescript
// Add import
import { GitPanel } from './components/git-panel'

// In component, get settings state
const { settings, loadSettings, gitPanelOpen, setGitPanelOpen } = useSettingsStore()

// In JSX, update main content area:
{/* Main Content */}
<div className="flex-1 flex overflow-hidden">
  {activeProjectId ? (
    <>
      <Sidebar />
      <div className="flex-1 min-w-0 relative">
        <TerminalGrid
          terminals={projectTerminals}
          activeTerminalId={activeTerminalId}
          onTerminalClick={setActiveTerminal}
          onAddTerminal={handleAddTerminal}
          onCloseTerminal={handleCloseTerminal}
          onStartClaude={handleStartClaude}
          onInsertFilePath={handleInsertFilePath}
        />
        {/* Git Panel Toggle + Panel */}
        <GitPanel
          projectPath={activeProject?.path}
          isOpen={gitPanelOpen}
          onToggle={() => setGitPanelOpen(!gitPanelOpen)}
        />
      </div>
    </>
  ) : (
    <WelcomeScreen onAddProject={handleAddProject} />
  )}
</div>
```

### Step 3: Update GitPanel Position

The GitPanel needs to be outside the relative container. Modify App.tsx:

```typescript
{/* Main Content */}
<div className="flex-1 flex overflow-hidden">
  {activeProjectId ? (
    <>
      <Sidebar />
      <div className="flex-1 min-w-0">
        <TerminalGrid
          terminals={projectTerminals}
          activeTerminalId={activeTerminalId}
          onTerminalClick={setActiveTerminal}
          onAddTerminal={handleAddTerminal}
          onCloseTerminal={handleCloseTerminal}
          onStartClaude={handleStartClaude}
          onInsertFilePath={handleInsertFilePath}
        />
      </div>
      {/* Git Panel */}
      <GitPanel
        projectPath={activeProject?.path}
        isOpen={gitPanelOpen}
        onToggle={() => setGitPanelOpen(!gitPanelOpen)}
      />
    </>
  ) : (
    <WelcomeScreen onAddProject={handleAddProject} />
  )}
</div>
```

### Step 4: Update GitPanel Component

Remove absolute positioning for toggle, make it inline:

```typescript
// git-panel.tsx - updated structure
export function GitPanel({ projectPath, isOpen, onToggle }: GitPanelProps) {
  // ... hook logic ...

  if (!isOpen) {
    // Collapsed state - just show toggle button
    return (
      <div className="w-8 bg-[var(--mc-bg-secondary)] border-l border-[var(--mc-border)] flex flex-col items-center pt-2">
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-[var(--mc-bg-hover)] rounded"
          title="Open Git Panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
      </div>
    )
  }

  // Open state - full panel
  return (
    <div className="w-72 bg-[var(--mc-bg-secondary)] border-l border-[var(--mc-border)] flex flex-col">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--mc-border)]">
        <span className="text-sm font-medium">Git</span>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
            title="Refresh"
          >
            <svg className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
            title="Close"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Rest of panel */}
      <ChangesList ... />
      <DiffViewer ... />
      <CommitForm ... />
    </div>
  )
}
```

### Step 5: Add Sidebar Toggle (Optional Enhancement)

In sidebar.tsx, add a quick toggle for the Git panel in the Git section:

```typescript
// In Git section, add button to open panel
{gitStatus?.isRepo && (
  <button
    onClick={() => useSettingsStore.getState().setGitPanelOpen(true)}
    className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] rounded mt-2"
  >
    Open Git Panel
  </button>
)}
```

## Todo List

- [ ] Add gitPanelOpen state to settings-store.ts
- [ ] Import GitPanel in App.tsx
- [ ] Add GitPanel to App.tsx layout
- [ ] Update GitPanel collapsed state UI
- [ ] Optional: Add sidebar toggle button
- [ ] Test panel toggle persistence
- [ ] Test layout responsiveness

## Success Criteria

- Panel appears on right side of terminal grid
- Toggle button visible when closed
- Panel opens/closes smoothly
- Layout doesn't break with different screen sizes
- State persists across project switches

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Layout overflow | Medium | Medium | Use flex-shrink-0 on panel |
| Mobile responsiveness | Low | Low | Hide panel on small screens |

## Security Considerations

None for this phase.

## Final Testing Checklist

- [ ] Create git repo, verify panel loads files
- [ ] Stage file via panel, verify git status changes
- [ ] Unstage file via panel
- [ ] View diff for modified file
- [ ] Commit changes with message
- [ ] Discard unstaged changes
- [ ] Toggle panel open/closed
- [ ] Switch projects, verify panel updates
- [ ] Verify no console errors
