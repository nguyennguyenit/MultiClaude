# Phase 3: Terminal Pane Polish

## Context

- Plan: `plans/260104-0354-ui-redesign-phase2/plan.md`
- Design: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 197)

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 1h

Add copy button to terminal pane header for copying terminal output.

## Key Insights

Current header buttons in `terminal-pane.tsx`:
- Insert file path button (📁)
- Start Claude button (⚡)
- Close button (✕)

Design spec wants:
- Copy button (📋) - copy terminal output
- Pin button (📌) - future feature

## Requirements

### Design Spec
```
┌──────────────────────────────────────────────────────┐
│ Terminal 1                               📋 📌 ✕    │
└──────────────────────────────────────────────────────┘
```

### Implementation Priority
1. **Copy button** - Copy terminal output to clipboard (implement now)
2. **Pin button** - Placeholder for future (optional)

## Architecture

Copy functionality:
- Terminal output stored in `TerminalWithOutput.output` (last 100KB)
- Can pass via prop or access via store
- Use `navigator.clipboard.writeText()`

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/components/terminal/terminal-pane.tsx` | Add copy button |

## Implementation Steps

### Step 1: Add onCopy Prop

```tsx
interface TerminalPaneProps {
  // ... existing props
  onCopy?: () => void  // Optional callback
}
```

### Step 2: Add Copy Handler in App.tsx

```tsx
const handleCopyTerminalOutput = useCallback((terminalId: string) => {
  const terminal = terminals.find(t => t.id === terminalId)
  if (terminal?.output) {
    navigator.clipboard.writeText(terminal.output)
    // Optional: show toast notification
    useToastStore.getState().addToast('Copied to clipboard', 'success')
  }
}, [terminals])
```

### Step 3: Add Copy Button to Header

In `terminal-pane.tsx` header:

```tsx
{/* Copy button */}
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation()
    onCopy?.()
  }}
  className="p-0.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
  title="Copy terminal output"
  aria-label="Copy output"
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
</button>
```

### Step 4: Reorder Header Buttons

New order (left to right):
1. Title (editable)
2. Claude badge (if active)
3. Copy button (📋)
4. Insert file button (📁)
5. Start Claude button (⚡)
6. Close button (✕)

### Step 5: Pass Handler Through Grid

```tsx
// terminal-grid.tsx
<TerminalPane
  ...
  onCopy={() => onCopyOutput?.(terminal.id)}
/>

// Add prop to TerminalGridProps
onCopyOutput?: (terminalId: string) => void
```

## Todo List

- [ ] Add `onCopy` prop to TerminalPaneProps
- [ ] Add copy button SVG icon
- [ ] Add copy button to header
- [ ] Reorder header buttons per design
- [ ] Add `onCopyOutput` to TerminalGridProps
- [ ] Create `handleCopyTerminalOutput` in App.tsx
- [ ] Pass handler through grid to pane
- [ ] Add toast notification on copy
- [ ] Test copy functionality

## Success Criteria

- [ ] Copy button visible in terminal header
- [ ] Clicking copy puts output in clipboard
- [ ] Toast shows "Copied to clipboard"
- [ ] Button order matches design spec
- [ ] Works with empty output (no error)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large output copy performance | Low | Output already truncated to 100KB |
| Clipboard API support | Low | Modern browsers all support |

## Security Considerations

- Clipboard write is user-initiated (secure)
- No sensitive data concerns (user's own terminal output)

## Next Steps

Phase 2 complete. Proceed to Phase 3 or Phase 4 of overall UI redesign.
