# Phase 2: Testing & Verification

## Context

- **Plan**: `plans/260110-0132-cursor-blink-fix/plan.md`
- **Phase 1**: `plans/260110-0132-cursor-blink-fix/phase-1-implementation.md`
- **Test Scenarios**: `plans/reports/verification-260110-0127-cursor-bug-test-plan.md`
- **Codebase**: `docs/codebase-summary.md`

## Overview

| Attribute | Value |
|-----------|-------|
| Date | 2026-01-10 |
| Description | Verify cursor blink fix works correctly |
| Priority | P1 |
| Status | pending |
| Effort | 1h |

## Key Insights

1. xterm.js cursor only blinks when terminal has focus
2. Terminal focus triggered by `isActive={true}` prop
3. Visual verification required (cursor animation)
4. State verification via DevTools console

## Requirements

1. Verify cursor blinks after project switch
2. Test rapid project switching stability
3. Test empty project edge case
4. Ensure no regression in existing functionality

## Architecture

### Test Data Setup

```
Project A: 2-3 terminals (term-a-1, term-a-2, term-a-3)
Project B: 2 terminals (term-b-1, term-b-2)
Project C: 0 terminals (empty)
```

### Verification Points

1. **State**: `activeTerminalId` matches first terminal of new project
2. **Visual**: Cursor blinks in active terminal
3. **DOM**: Active terminal has `isActive={true}` indicator
4. **Performance**: No visual glitches during transition

## Related Code Files

| File | Purpose |
|------|---------|
| `src/renderer/components/terminal/terminal-view.tsx` | Focus effect |
| `src/renderer/components/terminal/terminal-grid.tsx` | isActive prop |
| `src/renderer/components/terminal/terminal-pane.tsx` | Active styling |

## Test Cases

### Test Case 1: Basic Project Switch

**Scenario**: Switch from Project A (with active terminal) to Project B

**Steps**:
1. Start app, ensure Project A is active
2. Click any terminal in Project A (to ensure cursor works initially)
3. Click Project B tab
4. Observe terminal behavior

**Expected Results**:
- First terminal of Project B has cursor blinking
- `activeTerminalId` equals first terminal ID of Project B
- No console errors

**Verification Method**:
```javascript
// In browser DevTools console
console.log('activeTerminalId:', useAppStore.getState().activeTerminalId)
console.log('Project B terminals:',
  useAppStore.getState().terminals
    .filter(t => t.projectId === 'project-b')
    .map(t => t.id)
)
```

---

### Test Case 2: Rapid Project Switching

**Scenario**: Switch A → B → C → A rapidly

**Steps**:
1. Start with Project A active
2. Quickly click: Project B → Project C → Project A
3. Wait for transitions to complete

**Expected Results**:
- No state corruption
- Final state: activeTerminalId belongs to Project A
- Cursor blinks correctly in final active terminal
- No visual glitches or frozen UI

**Edge Case**: Rapid clicks during `projectSwitching=true` should be ignored (guard clause)

---

### Test Case 3: Empty Project Switch

**Scenario**: Switch from populated project to empty project

**Steps**:
1. Start with Project A (has terminals)
2. Create Project C with no terminals
3. Switch to Project C

**Expected Results**:
- `activeTerminalId = null`
- No errors in console
- UI shows empty state correctly
- No stale cursor behavior

---

### Test Case 4: New Terminal After Switch

**Scenario**: Create terminal in project after switching

**Steps**:
1. Switch to Project B
2. Verify first terminal active
3. Create new terminal (Ctrl+N)

**Expected Results**:
- New terminal becomes active (existing behavior)
- Cursor blinks in new terminal
- No interference from previous state

---

### Test Case 5: Project Deletion While Active

**Scenario**: Delete project that is currently active

**Steps**:
1. Activate Project A
2. Delete Project A
3. Observe state

**Expected Results**:
- App handles gracefully (existing behavior)
- activeTerminalId cleared appropriately
- No crash or frozen state

---

## Manual Verification Checklist

### Visual Checks

- [ ] Cursor blinks (~500ms interval) in active terminal after switch
- [ ] Active terminal has visual highlight/glow
- [ ] Inactive terminals do NOT steal focus
- [ ] No cursor flickering in multiple terminals
- [ ] Transition animation smooth (fade/opacity)

### State Checks (DevTools)

```javascript
// Paste in DevTools console after each test
const state = useAppStore.getState()
console.log({
  activeProjectId: state.activeProjectId,
  activeTerminalId: state.activeTerminalId,
  terminalCount: state.terminals.filter(t =>
    t.projectId === state.activeProjectId
  ).length,
  firstTerminalId: state.terminals
    .filter(t => t.projectId === state.activeProjectId)[0]?.id
})
```

### Functional Checks

- [ ] Keyboard input works in active terminal after switch
- [ ] Click on different terminal changes active state
- [ ] Alt+1-9 project switching works correctly
- [ ] Ctrl+N creates terminal in correct project

## Console Log Verification (Optional Debug)

If issues occur, temporarily add logging:

**File**: `src/renderer/App.tsx` (in handleSelectProject, after terminal selection)

```typescript
// DEBUG ONLY - remove before commit
console.log('[handleSelectProject]', {
  newProjectId: id,
  selectedTerminalId: newProjectTerminals[0]?.id || null,
  terminalCount: newProjectTerminals.length
})
```

**File**: `src/renderer/components/terminal/terminal-view.tsx` (in focus effect)

```typescript
// DEBUG ONLY - remove before commit
console.log(`[Terminal ${terminalId}] isActive:`, isActive,
  isActive ? '→ calling focus()' : '→ skipping focus()'
)
```

## Todo List

- [ ] Build app with fix (`npm run electron:dev`)
- [ ] Execute Test Case 1: Basic project switch
- [ ] Execute Test Case 2: Rapid switching
- [ ] Execute Test Case 3: Empty project
- [ ] Execute Test Case 4: New terminal after switch
- [ ] Execute Test Case 5: Project deletion
- [ ] Complete visual verification checklist
- [ ] Complete state verification (DevTools)
- [ ] Remove any debug logs
- [ ] Confirm no TypeScript/ESLint errors

## Success Criteria

### Mandatory

- [x] All 5 test cases pass
- [x] No console errors during testing
- [x] Cursor blinks correctly in all scenarios
- [x] No regression in existing functionality

### Optional (nice to have)

- [ ] Add automated Playwright test (future enhancement)
- [ ] Document any edge cases discovered

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Cursor still broken | Low | High | Verify focus() is called via console |
| Regression in other features | Low | Medium | Test terminal CRUD operations |
| Visual glitch during transition | Low | Low | Keep existing dispose delay |

## Security Considerations

None - testing phase with no security implications.

## Next Steps

After all tests pass:
1. Remove any debug logs
2. Final code review
3. Commit with message: `fix(terminal): auto-activate first terminal on project switch`
4. Close related issue/ticket
