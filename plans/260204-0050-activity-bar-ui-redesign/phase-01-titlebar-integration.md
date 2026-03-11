# Phase 1: Titlebar Integration

## Overview

- **Priority:** P1
- **Status:** pending
- **Effort:** 1.5h

Redesign titlebar to include logo (responsive) and project tabs. Remove hamburger menu.

## Key Insights

- Current titlebar: hamburger toggle + centered "MultiClaude" text
- Project tabs currently in separate `ProjectTabs` component below titlebar
- macOS needs ml-16 for traffic lights (already handled with `isMac` check)
- Logo asset exists at `src/renderer/assets/logo.png`

## Requirements

### Functional
- Logo on left side (after traffic lights on macOS)
- Logo responsive: icon only when activity bar collapsed/hidden, icon+text when expanded
- Project tabs inline after logo
- [+] button for new project (already exists in ProjectTabs)
- Remove hamburger menu button

### Non-Functional
- Maintain titlebar drag functionality (`titlebar-drag` class)
- Buttons must have `titlebar-no-drag` class
- Keep h-10 height for titlebar

## Architecture

```
Titlebar Layout:
+--------+------------------------------------------+
| [Logo] | [Tab1][Tab2][+]     "MultiClaude"        |
+--------+------------------------------------------+
   ^           ^                    ^
   |           |                    |
   |           |                    Center (optional, shown if space)
   |           Flex container with tabs
   Responsive: icon only or icon+text
```

## Related Code Files

### Files to Modify
- `src/renderer/App.tsx` - Titlebar section (~lines 445-468)
- `src/renderer/components/project-tabs/project-tabs.tsx` - Remove outer container

### Files to Reference
- `src/renderer/components/sidebar/sidebar-header.tsx` - Logo usage pattern

## Implementation Steps

### Step 1: Create TitlebarLogo component
```typescript
// In App.tsx or new file: src/renderer/components/titlebar-logo.tsx
function TitlebarLogo({ showText }: { showText: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 titlebar-no-drag">
      <img src={logoImg} alt="MultiClaude" className="w-5 h-5 object-contain" />
      {showText && (
        <span className="font-semibold text-sm">MultiClaude</span>
      )}
    </div>
  )
}
```

### Step 2: Modify ProjectTabs to be inline-friendly
- Remove outer container div with bg/border
- Return just the tabs flex container
- Parent (App.tsx titlebar) provides styling

### Step 3: Update App.tsx titlebar
```tsx
{/* Title Bar */}
<div className="h-10 bg-[var(--mc-bg-tertiary)] flex items-center titlebar-drag relative">
  {/* macOS traffic light spacing */}
  {isMac && <div className="w-16 flex-shrink-0" />}

  {/* Logo - responsive */}
  <TitlebarLogo showText={activityBarState === 'expanded'} />

  {/* Project Tabs - inline */}
  <ProjectTabs
    projects={projects}
    activeProjectId={activeProjectId}
    onSelectProject={handleSelectProject}
    onAddProject={handleAddProject}
    onDeleteProject={handleDeleteProject}
  />

  {/* Centered title (shown when no tabs or on wide screens) */}
  {projects.length === 0 && (
    <span className="absolute left-1/2 -translate-x-1/2 text-sm font-medium pointer-events-none">
      MultiClaude
    </span>
  )}
</div>
```

### Step 4: Remove hamburger button
- Delete the button element with `data-testid="titlebar-sidebar-toggle"`
- Remove `toggleSidebar` usage from titlebar

## Todo List

- [ ] Create TitlebarLogo component in App.tsx
- [ ] Refactor ProjectTabs to remove outer wrapper
- [ ] Update App.tsx titlebar layout
- [ ] Remove hamburger toggle button
- [ ] Test macOS traffic light spacing
- [ ] Test with 0, 1, 5, 10+ projects

## Success Criteria

- Logo visible in titlebar
- Logo shows text only when activity bar expanded
- Project tabs display inline after logo
- No hamburger menu visible
- Titlebar remains draggable
- macOS traffic lights unobstructed

## Security Considerations

- None (UI-only changes)

## Next Steps

- Phase 2: Create Activity Bar component to replace sidebar
