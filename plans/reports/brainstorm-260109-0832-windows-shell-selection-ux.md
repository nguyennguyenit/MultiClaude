# Brainstorm: Windows Shell Selection UX

**Date**: 2026-01-09
**Status**: Agreed - Ready for Implementation

## Problem Statement

Trên Windows, user không thể chọn giữa CMD và PowerShell trong:
- Settings > Terminals > Default Shell
- New Terminal button (right-click context menu)

Khi chưa cài WSL, các section này bị ẩn do điều kiện check sai.

## Root Cause

Current condition: `wslInfo?.available === true`

| Platform          | wslInfo state                      | Current | Expected |
|-------------------|------------------------------------| ------- | -------- |
| Linux/macOS       | null                               | Hidden  | Hidden   |
| Windows no WSL    | { available: false, distros: [] }  | Hidden  | **Shown** |
| Windows with WSL  | { available: true, distros: [...]} | Shown   | Shown    |

**Key insight**: `wslInfo !== null` đã là proxy cho "is Windows" vì detection chỉ chạy trên Windows.

## Solution: Minimal Change

### Changes Required

| File | Line | Current | Fix |
|------|------|---------|-----|
| `terminal-settings.tsx` | 74 | `wslInfo?.available === true` | `wslInfo !== null` |
| `terminal-action-bar.tsx` | 31 | `wslInfo?.available === true` | `wslInfo !== null` |

### Behavior After Fix

**Settings**:
- Windows (no WSL): Shows CMD, PowerShell
- Windows (with WSL): Shows CMD, PowerShell, WSL distros
- Linux/macOS: Hidden (correct)

**New Terminal context menu**:
- Same behavior as above

### Code Changes

```tsx
// terminal-settings.tsx:74
// Before
const showShellSettings = wslInfo?.available === true

// After
// Show shell settings on Windows (wslInfo is only set on Windows platform)
const showShellSettings = wslInfo !== null
```

```tsx
// terminal-action-bar.tsx:31
// Before
const canSelectShell = wslInfo?.available === true

// After
// Allow shell selection on Windows (wslInfo is only set on Windows platform)
const canSelectShell = wslInfo !== null
```

## Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| A: Minimal change | 2 lines, no breaking changes | Semantics slightly confusing | ✓ Selected |
| B: Add isWindows field | Self-documenting | Breaking change, more files | Rejected |
| C: Separate platform detection | Clean separation | Over-engineered, YAGNI | Rejected |

## Risk Assessment

- **Low risk**: No API changes, no type changes
- **Testing needed**: Manual test on Windows without WSL

## Implementation Effort

- **Scope**: 2 files, 2 line changes
- **Complexity**: Trivial
- **Testing**: Manual verification on Windows

## Success Metrics

- [ ] Settings shows CMD/PowerShell on Windows without WSL
- [ ] Right-click on "+ New" shows shell dropdown on Windows without WSL
- [ ] WSL distros appear when WSL is installed
- [ ] No regression on Linux/macOS (settings hidden)
