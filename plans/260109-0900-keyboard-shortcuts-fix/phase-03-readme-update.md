# Phase 3: README Update

## Context Links
- Parent plan: [plan.md](./plan.md)
- Dependency: [Phase 1](./phase-01-xterm-shortcut-intercept.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P3 |
| Effort | 15m |
| Implementation | ✅ DONE |
| Review | ✅ DONE |

## Requirements
1. Add `Ctrl+T` to keyboard shortcuts table
2. Clarify that shortcuts work when terminal is focused

## Related Code Files
| File | Purpose |
|------|---------|
| `README.md` | Project documentation - MODIFY |

## Implementation Steps

### Step 1: Update README.md keyboard shortcuts section
Update the table (around lines 91-101):

```markdown
### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Switch to Project 1-9 | Alt+1 to Alt+9 |
| New Terminal | Ctrl+N or Ctrl+T |
| Close Active Terminal | Ctrl+W |
| Copy | Select text (auto-copies) |
| Paste | Right-click or Ctrl+V |
| Paste Image | Ctrl+V (clipboard image > temp file > insert path) |
| Insert File Path | Drag-and-drop file |

> **Note:** All shortcuts work regardless of terminal focus.
```

## Todo List
- [x] Add Ctrl+T to New Terminal shortcut
- [x] Add note about shortcuts working in terminal
- [x] Review for accuracy

## Success Criteria
- [x] README accurately reflects new shortcuts
- [x] Note clarifies terminal focus behavior
