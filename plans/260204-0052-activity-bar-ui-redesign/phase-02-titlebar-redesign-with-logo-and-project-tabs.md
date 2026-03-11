# Phase 02: Titlebar Redesign with Logo and Project Tabs

## Context Links

- [App.tsx](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/App.tsx)
- [ProjectTabs](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/project-tabs/project-tabs.tsx)
- [SidebarHeader](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/sidebar/sidebar-header.tsx)
- [Phase 01](./phase-01-state-management-and-store-updates.md)

## Overview

- **Priority:** P1
- **Status:** pending
- **Effort:** 1.5h
- **Depends on:** Phase 01

Merge titlebar and project tabs into single row with logo replacing hamburger menu.

## Key Insights

- Current: Titlebar (h-10) + ProjectTabs (h-9) = 76px total
- New: Single titlebar (h-10) containing logo + tabs = 40px (saves 36px)
- Logo asset already exists: `src/renderer/assets/logo.png`
- macOS needs 64px left padding for traffic lights
- Titlebar must remain draggable except for interactive elements

## Requirements

### Functional

- FR-01: Logo displays in titlebar (icon-only when Activity Bar hidden/collapsed, icon+text when expanded)
- FR-02: Project tabs render after logo in same row
- FR-03: "Add project" button stays after last tab
- FR-04: Clicking logo does nothing (branding only)
- FR-05: Remove hamburger menu button entirely

### Non-functional

- NFR-01: Titlebar remains draggable (titlebar-drag class)
- NFR-02: All buttons/tabs must be no-drag
- NFR-03: macOS traffic light offset preserved

## Architecture

```
New Titlebar Layout:
┌──────────────────────────────────────────────────────────┐
│ [64px mac] [Logo] [Tab1][Tab2][Tab3][+] ───────────────  │
└──────────────────────────────────────────────────────────┘
              ↑
              Logo behavior:
              - Activity Bar expanded: icon + "MultiClaude"
              - Activity Bar collapsed/hidden: icon only
```

## Related Code Files

### To Modify

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Restructure titlebar, remove ProjectTabs separate row |
| `src/renderer/components/project-tabs/project-tabs.tsx` | Make embeddable in titlebar, remove h-9 container |

### To Create

| File | Purpose |
|------|---------|
| `src/renderer/components/titlebar/titlebar-with-tabs-and-logo.tsx` | New unified titlebar |
| `src/renderer/components/titlebar/titlebar-logo.tsx` | Logo with conditional text |
| `src/renderer/components/titlebar/index.ts` | Exports |

## Implementation Steps

1. **Create titlebar-logo.tsx**
   ```typescript
   interface TitlebarLogoProps {
     showText: boolean  // true when Activity Bar expanded
   }

   export function TitlebarLogo({ showText }: TitlebarLogoProps) {
     return (
       <div className="flex items-center gap-2 titlebar-no-drag">
         <img src={logoImg} alt="MultiClaude" className="w-5 h-5" />
         {showText && (
           <span className="font-semibold text-sm">MultiClaude</span>
         )}
       </div>
     )
   }
   ```

2. **Create titlebar-with-tabs-and-logo.tsx**
   - Accept all ProjectTabs props
   - Read activityBarState from store
   - Render: Logo → Tabs → Add button
   - Handle macOS left offset

3. **Update project-tabs.tsx**
   - Remove outer container div with h-9 and border-b
   - Export inner content as reusable component
   - Keep all existing tab logic

4. **Update App.tsx**
   - Replace old titlebar div with new Titlebar component
   - Remove separate ProjectTabs row
   - Remove hamburger menu button

## Todo List

- [ ] Create titlebar/ directory structure
- [ ] Create titlebar-logo.tsx component
- [ ] Create titlebar-with-tabs-and-logo.tsx component
- [ ] Refactor project-tabs.tsx to be embeddable
- [ ] Update App.tsx layout
- [ ] Remove hamburger menu from titlebar
- [ ] Test macOS traffic light offset
- [ ] Test drag regions work correctly
- [ ] Verify keyboard shortcuts (Alt+1-9) still work

## Success Criteria

- [ ] Single titlebar row (h-10) contains logo and tabs
- [ ] Logo shows icon+text when Activity Bar expanded
- [ ] Logo shows icon-only when Activity Bar collapsed/hidden
- [ ] No hamburger menu button
- [ ] Titlebar draggable, buttons/tabs not draggable
- [ ] macOS has proper left offset for traffic lights
- [ ] Alt+1-9 shortcuts still switch projects

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Drag region conflicts | Medium | Careful titlebar-no-drag on all interactives |
| Tab overflow with logo | Low | Logo width is small (~100px max) |
| macOS layout issues | Medium | Test on macOS or use isMac conditional |

## Security Considerations

None - UI layout only.

## Next Steps

After completion:
- Phase 03 can build Activity Bar that controls logo text visibility
- Titlebar height savings (36px) gives more terminal space
