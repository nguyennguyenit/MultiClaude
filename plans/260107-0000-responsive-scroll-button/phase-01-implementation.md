# Phase 01: Implementation

## Context

- Parent plan: [plan.md](./plan.md)
- Brainstorm: [brainstorm report](../reports/brainstorm-260107-0000-responsive-scroll-button.md)

## Overview

| Field | Value |
|-------|-------|
| Priority | P3 |
| Status | Done |
| Effort | 20m |
| Description | Add CSS Container Queries for responsive scroll button sizing |

## Key Insights

- CSS `cqw` unit = 1% of container query width
- `container-type: size` enables container queries on parent
- `clamp(min, preferred, max)` enforces bounds
- Electron 33 uses Chromium 128 → full support

## Requirements

### Functional
- Button size: 3-4% of terminal container width
- Min size: 20px (clickable)
- Max size: 32px (prevent oversized)
- Maintain square aspect ratio

### Non-Functional
- Pure CSS, no JS state changes
- Zero re-renders on resize
- Instant visual response

## Architecture

```
terminal-container-wrapper (container-type: size)
├── terminal-container (xterm.js)
└── button (width/height: clamp(20px, 4cqw, 32px))
    └── svg (width/height: clamp(12px, 2cqw, 16px))
```

## Related Code Files

| Action | File |
|--------|------|
| Modify | `src/renderer/components/terminal/terminal-view.tsx` |

## Implementation Steps

1. **Add container-type to wrapper** (line 68-71)
   - Add `containerType: 'size'` to inline style object

2. **Replace button fixed sizing** (line 80-93)
   - Remove Tailwind `p-2` class
   - Add inline styles:
     ```tsx
     style={{
       width: 'clamp(20px, 4cqw, 32px)',
       height: 'clamp(20px, 4cqw, 32px)',
       padding: 'clamp(4px, 1cqw, 8px)'
     }}
     ```

3. **Replace SVG fixed sizing** (line 90)
   - Remove Tailwind `w-4 h-4` classes
   - Add inline styles:
     ```tsx
     style={{
       width: 'clamp(12px, 2cqw, 16px)',
       height: 'clamp(12px, 2cqw, 16px)'
     }}
     ```

## Code Changes

### Before (current)
```tsx
<div
  className="terminal-container-wrapper"
  style={{ height: '100%', width: '100%', position: 'relative' }}
>
  ...
  <button
    className={`absolute bottom-3 right-3 z-50 p-2 rounded-full ...`}
  >
    <svg className="w-4 h-4" ...>
```

### After (target)
```tsx
<div
  className="terminal-container-wrapper"
  style={{ height: '100%', width: '100%', position: 'relative', containerType: 'size' }}
>
  ...
  <button
    className={`absolute bottom-3 right-3 z-50 rounded-full ...`}
    style={{
      width: 'clamp(20px, 4cqw, 32px)',
      height: 'clamp(20px, 4cqw, 32px)',
      padding: 'clamp(4px, 1cqw, 8px)'
    }}
  >
    <svg
      style={{ width: 'clamp(12px, 2cqw, 16px)', height: 'clamp(12px, 2cqw, 16px)' }}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
```

## Todo List

- [x] Add `containerType: 'size'` to wrapper style
- [x] Remove `p-2` from button className
- [x] Add button inline style with clamp()
- [x] Remove `w-4 h-4` from SVG className
- [x] Add SVG inline style with clamp()

## Success Criteria

- Button renders at ~4% of container width
- Size stays within 20-32px bounds
- Resizing terminal resizes button smoothly
- No console errors

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CSS specificity conflict | Low | Low | Inline styles override Tailwind |
| Container query unsupported | None | N/A | Electron 33 = Chromium 128 |

## Security Considerations

None - pure CSS styling change.

## Next Steps

→ [Phase 02: Testing](./phase-02-testing.md)
