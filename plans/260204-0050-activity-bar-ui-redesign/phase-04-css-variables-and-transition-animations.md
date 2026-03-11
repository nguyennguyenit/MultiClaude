# Phase 4: CSS Variables and Transition Animations

## Overview

- **Priority:** P2
- **Status:** pending
- **Effort:** 1h

Update CSS variables for activity bar widths. Add smooth transition animations between states.

## Key Insights

- Current variables: `--mc-sidebar-width-expanded: 240px`, `--mc-sidebar-width-collapsed: 60px`
- Need new variables for activity bar: 48px collapsed, 200px expanded, 0px hidden
- Transition duration already exists: `--mc-sidebar-transition: 200ms ease-in-out`

## Requirements

### Functional
- Smooth width transitions between all 3 states
- Content area expands/contracts smoothly
- No layout jump or flash during transitions

### Non-Functional
- Use CSS variables for maintainability
- Reuse existing transition timing
- Support reduced-motion preference

## Architecture

```
CSS Variables:
--mc-activity-bar-width-collapsed: 48px
--mc-activity-bar-width-expanded: 200px
--mc-activity-bar-transition: 200ms ease-in-out

States:
- collapsed: width = 48px, icons centered
- expanded: width = 200px, icons + text left-aligned
- hidden: width = 0px, overflow hidden
```

## Related Code Files

### Files to Modify
- `src/renderer/styles/globals.css` - Add/update CSS variables
- `src/renderer/components/activity-bar/activity-bar.tsx` - Apply transition classes

### Files to Reference
- Current sidebar transition: `transition-[width] duration-[var(--mc-sidebar-transition)]`

## Implementation Steps

### Step 1: Update globals.css
```css
/* Activity Bar Variables */
:root {
  --mc-activity-bar-width-collapsed: 48px;
  --mc-activity-bar-width-expanded: 200px;
  --mc-activity-bar-transition: 200ms ease-in-out;
}

/* Remove old sidebar variables (or keep for backwards compat) */
/* --mc-sidebar-width-expanded: 240px; */
/* --mc-sidebar-width-collapsed: 60px; */
```

### Step 2: Activity bar transition classes
```tsx
// activity-bar.tsx
const widthClasses: Record<ActivityBarState, string> = {
  collapsed: 'w-[var(--mc-activity-bar-width-collapsed)]',
  expanded: 'w-[var(--mc-activity-bar-width-expanded)]',
  hidden: 'w-0'
}

<div
  className={`
    ${widthClasses[activityBarState]}
    bg-[var(--mc-bg-secondary)]
    border-r border-[var(--mc-border)]
    flex flex-col h-full
    transition-[width] duration-[var(--mc-activity-bar-transition)]
    overflow-hidden
  `}
>
```

### Step 3: Content area transition
```tsx
// App.tsx - Content needs to expand as activity bar shrinks
<div className="flex-1 min-w-0 flex flex-col relative transition-[margin] duration-[var(--mc-activity-bar-transition)]">
```

### Step 4: Reduced motion support
```css
/* globals.css */
@media (prefers-reduced-motion: reduce) {
  :root {
    --mc-activity-bar-transition: 0ms;
  }
}
```

### Step 5: Hidden state overflow handling
```css
/* When hidden, ensure no content bleeds */
.activity-bar-hidden {
  width: 0;
  padding: 0;
  border-width: 0;
  overflow: hidden;
}
```

### Step 6: Icon/text fade transitions
```tsx
// activity-bar-item.tsx
// Text fades in/out during expand/collapse
{!collapsed && (
  <span className="text-sm transition-opacity duration-150 opacity-100">
    {label}
  </span>
)}

// Or use CSS for smoother fade
<span className={`
  text-sm transition-opacity duration-150
  ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}
`}>
  {label}
</span>
```

## Todo List

- [ ] Add CSS variables to globals.css
- [ ] Remove/deprecate old sidebar variables
- [ ] Apply width transition to activity bar
- [ ] Add content area margin transition
- [ ] Implement reduced motion support
- [ ] Add text fade transition for labels
- [ ] Test all state transitions
- [ ] Test with reduced motion enabled

## Success Criteria

- Width transitions smoothly between all states
- No layout jump during transitions
- Content area expands correctly
- Text labels fade in/out smoothly
- Respects reduced motion preference

## Security Considerations

- None (CSS only)

## Next Steps

- Phase 5: Cleanup old sidebar code and polish
