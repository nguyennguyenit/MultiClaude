# Phase 2: YOLO Mode Migration

## Context

- Plan: `plans/260104-0354-ui-redesign-phase2/plan.md`
- Depends: Phase 1 (Terminal Action Bar)

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 1h

Move YOLO mode from sidebar Tools section to terminal action bar.

## Key Insights

Current YOLO implementation in `sidebar.tsx`:
- State: `yoloEnabled` local state
- Load: `window.electron.yolo.get(activeProject.path)`
- Toggle: `window.electron.yolo.set(activeProject.path, enabled)`
- Visual: Toggle switch with orange color when active

## Requirements

- Remove YOLO toggle from sidebar Tools section
- YOLO toggle already added in action bar (Phase 1)
- Keep existing IPC handlers unchanged

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/components/sidebar/sidebar.tsx` | Remove YOLO from Tools section |

## Implementation Steps

### Step 1: Remove YOLO from Sidebar

In `sidebar.tsx`, remove:

```tsx
// Remove this state
const [yoloEnabled, setYoloEnabled] = useState(false)

// Remove this useEffect
useEffect(() => {
  if (activeProject) {
    window.electron.yolo.get(activeProject.path).then(setYoloEnabled)
  } else {
    setYoloEnabled(false)
  }
}, [activeProject])

// Remove this handler
const handleYoloToggle = async (enabled: boolean) => {
  if (!activeProject) return
  const result = await window.electron.yolo.set(activeProject.path, enabled)
  if (result.success) {
    setYoloEnabled(enabled)
  }
}

// Remove this from Tools section JSX
{/* YOLO Mode Toggle */}
<div className={`w-full flex items-center justify-between...`}>
  <div className="flex items-center gap-2">
    <svg ...>...</svg>
    <span>YOLO Mode</span>
  </div>
  <YoloToggle ... />
</div>
```

### Step 2: Remove YoloToggle Component from Sidebar

If YoloToggle is defined locally in sidebar.tsx, either:
- Move to shared components, OR
- Delete if duplicated in action bar

### Step 3: Update Tools Section Layout

After removing YOLO, Tools section should only have:
- New Terminal button
- Kill All button

## Todo List

- [ ] Remove `yoloEnabled` state from sidebar
- [ ] Remove YOLO useEffect from sidebar
- [ ] Remove `handleYoloToggle` from sidebar
- [ ] Remove YOLO toggle JSX from Tools section
- [ ] Clean up unused YoloToggle component
- [ ] Test sidebar still works correctly
- [ ] Verify YOLO works from action bar

## Success Criteria

- [ ] No YOLO toggle in sidebar Tools section
- [ ] YOLO works correctly from action bar
- [ ] No console errors
- [ ] Sidebar layout looks clean without YOLO

## Next Steps

Proceed to Phase 3: Terminal Pane Polish
