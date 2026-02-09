# Scout Report: New Terminal Dropdown Z-Index Issue

## Issue Summary
On Windows, the "New Terminal" dropdown menu is covered/hidden by the terminal component below it.

## Key Files Found

### 1. Dropdown Components

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-action-bar.tsx`**
- Contains the "+ New" split button with dropdown toggle (lines 79-117)
- Uses `isolate` class on the wrapper div (line 81) - creates stacking context
- Renders `ShellSelectorDropdown` inside a `relative inline-flex` container

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/shell-selector-dropdown.tsx`**
- The dropdown menu component (lines 69-111)
- Uses `absolute right-0 top-full mt-1` positioning
- Has `z-50` class (line 76) for z-index

### 2. Container/Layout Components

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/App.tsx`** (lines 373-395)
- Renders `TerminalActionBar` then `TerminalGrid` as siblings inside a flex column
- Terminal area wrapper: `<div data-testid="terminal-area" className="flex-1 min-h-0">`

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-grid.tsx`**
- Contains the terminal panes grid layout
- Uses `react-resizable-panels` for layout

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-pane.tsx`**
- Individual terminal pane wrapper
- Has class `terminal-pane` with `position: relative` and `overflow: hidden`

### 3. CSS Files

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/styles/globals.css`**
- `.terminal-pane` (lines 193-201): `position: relative; overflow: hidden; will-change: opacity, box-shadow;`
- No explicit z-index defined for terminal pane

## Root Cause Analysis

The issue is a **stacking context problem**:

1. `TerminalActionBar` uses `isolate` class (line 81) which creates a new stacking context
2. The dropdown has `z-50` but it's inside the `isolate` container
3. The sibling `terminal-area` div and `.terminal-pane` with `position: relative` + `overflow: hidden` may create their own stacking context
4. On Windows, this combined with WSL detection might affect rendering order

## Potential Fixes

1. **Option A**: Add `z-index` to `TerminalActionBar` container div (line 68)
2. **Option B**: Remove `isolate` from the split-button wrapper and handle stacking differently
3. **Option C**: Add `relative z-10` to the action bar wrapper in App.tsx
4. **Option D**: Ensure terminal-area has lower z-index with `z-0`

## Component Hierarchy
```
App.tsx
└── flex-1 min-w-0 flex flex-col
    ├── TerminalActionBar (h-10, bg-secondary, border-b)
    │   └── relative inline-flex isolate (NEW TERMINAL BUTTON)
    │       ├── button "+ New"
    │       ├── button dropdown toggle (Windows only)
    │       └── ShellSelectorDropdown (z-50, absolute)
    └── div (flex-1 min-h-0) [terminal-area]
        └── TerminalGrid
            └── TerminalPane (position: relative, overflow: hidden)
```

## Unresolved Questions
- Does the `isolate` class alone cause the issue, or is it the combination with terminal-pane styles?
- Does this only occur when terminals are present, or also with empty grid?
