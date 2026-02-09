# Brainstorm Report: MultiClaude UI Redesign

> Date: 2026-01-04 | Status: Agreed

## Problem Statement

Redesign MultiClaude app UI để match 100% với design spec trong `plans/UX-UI/MultiClaude-UI-UX-Design.md`.

## Requirements

- **Reference**: Document UI/UX Design hiện tại
- **Scope**: Full redesign (Layout, Sidebar, Panels, Components)
- **Approach**: 100% theo spec, implement theo phases
- **Start**: Phase 1 - Layout Foundation

## Gap Analysis

| Component | Current | Target | Effort |
|-----------|---------|--------|--------|
| Sidebar | Fixed 256px | Collapsible 240px↔60px | High |
| Settings | Inline panel | Modal popup overlay | High |
| GitHub View | Không có | Standalone view + action bar | High |
| Terminal Action Bar | Không có | Status + action buttons | Medium |
| User Account Card | Không có | Avatar + status + branch | Medium |
| Navigation | Flat sections | Terminals/GitHub menu items | Medium |

## Implementation Phases

### Phase 1: Layout Foundation (SELECTED)
**Components to implement:**
1. Collapsible Sidebar (240px ↔ 60px)
   - Expand/collapse button
   - Smooth transition animations
   - Icon-only mode when collapsed
2. Navigation restructure
   - Terminals menu item (active state with accent border)
   - GitHub menu item
3. User Account Card
   - GitHub username display
   - Connection status indicator (green/gray/amber/red)
   - Current branch display
   - Hover tooltip when collapsed
4. Layout CSS updates
   - Adjust main content to respond to sidebar width
   - Title bar drag region

**Files affected:**
- `src/renderer/components/sidebar/sidebar.tsx`
- `src/renderer/stores/index.ts` (add sidebarCollapsed state)
- `src/renderer/styles/globals.css`
- `src/renderer/App.tsx`

### Phase 2: Terminal View Enhancement
- Terminal Action Bar component
- YOLO Mode toggle in action bar
- Terminal count display
- Kill All button with danger styling

### Phase 3: GitHub View (NEW)
- Standalone GitHub View component
- GitHub Action Bar (Push/Pull/Sync/Fetch)
- Repository info header
- GitHub Tabs integration

### Phase 4: Settings Modal
- Convert inline → modal overlay
- 3-tab structure
- Full terminal settings
- Save/Cancel actions

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Incremental changes, test each phase |
| State management complexity | Medium | Use Zustand store properly |
| Animation performance | Low | Use CSS transitions, not JS |

## Success Metrics

- [ ] Sidebar collapses smoothly (240px → 60px)
- [ ] Navigation shows correct active states
- [ ] User card displays GitHub info correctly
- [ ] No regression in existing features

## Next Steps

1. Create detailed implementation plan for Phase 1
2. Implement collapsible sidebar
3. Add navigation menu items
4. Create User Account Card component
5. Test and iterate

---

*Agreed by user on 2026-01-04*
