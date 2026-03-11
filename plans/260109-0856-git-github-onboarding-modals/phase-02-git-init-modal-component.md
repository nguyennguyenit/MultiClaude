# Phase 2: Git Init Modal Component

**Parent:** [plan.md](./plan.md)
**Dependencies:** Phase 1
**Blocks:** Phase 3

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P1 |
| Status | pending |
| Effort | 2h |

Build GitInitModal component matching existing modal patterns (discord-config-modal.tsx style).

---

## Requirements

- [ ] Modal appears with backdrop blur overlay
- [ ] Warning banner explaining Git importance
- [ ] Status message with alert icon
- [ ] "What we'll do" action list
- [ ] Collapsible manual instructions section
- [ ] "Don't ask again" checkbox
- [ ] Skip and Initialize buttons
- [ ] Loading state during git init
- [ ] Keyboard accessibility (Escape to close)

---

## Related Code

**Reference Modal:** `src/renderer/components/settings/discord-config-modal.tsx`

Key patterns:
- Props: `isOpen`, `onClose`, callback handlers
- Backdrop: `fixed inset-0 bg-black/50 flex items-center justify-center z-50`
- Container: `bg-[var(--mc-bg-secondary)] rounded-lg p-4 w-96 max-w-[90vw]`
- Close button with X icon
- Button styles: `bg-[var(--mc-accent)]` for primary

---

## Implementation Steps

### 1. Create Component Directory

```
src/renderer/components/git-init-modal/
  git-init-modal.tsx
  index.ts
```

### 2. Component Props Interface

```typescript
interface GitInitModalProps {
  isOpen: boolean
  folderPath: string
  folderName: string
  onClose: () => void
  onSkip: (dontAskAgain: boolean) => void
  onInitGit: () => Promise<void>
}
```

### 3. Component Structure

```tsx
export function GitInitModal({
  isOpen,
  folderPath,
  folderName,
  onClose,
  onSkip,
  onInitGit
}: GitInitModalProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showManual, setShowManual] = useState(false)

  if (!isOpen) return null

  const handleInit = async () => {
    setLoading(true)
    try {
      await onInitGit()
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    onSkip(dontAskAgain)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--mc-bg-secondary)] rounded-lg w-[420px] max-w-[90vw] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--mc-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranchIcon />
            <span className="font-medium">Git Repository Required</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[var(--mc-bg-hover)] rounded">
            <XIcon />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
          <p className="text-xs text-blue-400">
            Claude Code uses Git to safely build features and track changes.
          </p>
        </div>

        {/* Warning Status */}
        <div className="p-4">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <AlertCircleIcon className="text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">
                This folder is not a Git repository
              </p>
              <p className="text-xs text-[var(--mc-text-muted)] mt-1">
                Git needs to be initialized before continuing.
              </p>
            </div>
          </div>
        </div>

        {/* Actions List */}
        <div className="px-4 pb-4">
          <p className="text-xs text-[var(--mc-text-muted)] mb-2">We'll set up Git for you:</p>
          <div className="flex items-center gap-2 text-sm text-[var(--mc-text-primary)]">
            <GitBranchIcon className="w-4 h-4 text-[var(--mc-accent)]" />
            <span>Initialize a new Git repository</span>
          </div>
        </div>

        {/* Manual Instructions (collapsible) */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowManual(!showManual)}
            className="text-xs text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] flex items-center gap-1"
          >
            <ChevronIcon className={showManual ? 'rotate-90' : ''} />
            Prefer to do it manually?
          </button>
          {showManual && (
            <div className="mt-2 p-2 bg-[var(--mc-bg-primary)] rounded text-xs font-mono">
              <p className="text-[var(--mc-text-muted)] mb-1">Open terminal and run:</p>
              <code className="text-[var(--mc-accent)]">git init</code>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--mc-border)] flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-[var(--mc-text-muted)]">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="rounded"
            />
            Don't ask again for this project
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="px-3 py-1.5 text-xs bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)]"
            >
              Skip for now
            </button>
            <button
              onClick={handleInit}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Initializing...' : 'Initialize Git'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 4. Create Index Export

**File:** `src/renderer/components/git-init-modal/index.ts`

```typescript
export { GitInitModal } from './git-init-modal'
```

### 5. Add Icons (inline SVG or reuse existing)

Use inline SVG or extract from existing components:
- GitBranchIcon (from git-panel)
- AlertCircleIcon
- XIcon (close button)
- ChevronIcon (collapse toggle)

---

## Todo List

- [ ] Create git-init-modal directory
- [ ] Create git-init-modal.tsx with full structure
- [ ] Add icon components (inline SVG)
- [ ] Implement loading state
- [ ] Add keyboard handler (Escape to close)
- [ ] Create index.ts export
- [ ] Test component renders in isolation

---

## Success Criteria

- [ ] Modal renders with correct styling
- [ ] Checkbox state updates correctly
- [ ] Loading state shows during init
- [ ] Escape key closes modal
- [ ] Matches existing modal visual patterns
- [ ] Accessible (focus management, labels)

---

## Notes

- Keep component self-contained (~200 LOC)
- No external dependencies beyond React
- Match dark theme with amber warning colors
- Primary action button uses accent color
