---
parent: ./plan.md
status: pending
priority: P1
effort: 30m
---

# Phase 4: Testing

## Overview

Comprehensive testing to verify the fix works correctly. Includes manual testing, E2E test verification, and regression testing.

## Context Links

- [Parent Plan](./plan.md)
- [Phase 1: Restructure Grid](./phase-01-restructure-grid.md)
- [Phase 2: Cleanup App](./phase-02-cleanup-app.md)
- [Phase 3: Verify WebGL](./phase-03-verify-webgl.md)

## Manual Test Scenarios

### Test 1: Basic Project Switch (P1)
1. Open MultiClaude
2. Create Project A (folder picker)
3. Create terminal in Project A, type `echo "hello A"`
4. Note cursor position (should be after output)
5. Create Project B (folder picker)
6. Create terminal in Project B
7. Switch to Project A (via tab or Alt+1)
8. **VERIFY**: Cursor is in exact same position as step 4
9. **VERIFY**: Buffer shows "hello A" output

### Test 2: Rapid Project Switching (P1)
1. Have 2+ projects with terminals
2. Rapidly switch between projects (10 times in 5 seconds)
3. **VERIFY**: No console errors (open DevTools)
4. **VERIFY**: Cursor position preserved each time
5. **VERIFY**: No visual glitches or flickering

### Test 3: Multiple Terminals Per Project (P1)
1. Create project with 4 terminals
2. Type unique command in each terminal
3. Create second project with 2 terminals
4. Switch between projects
5. **VERIFY**: All 4 terminals in first project show correct output
6. **VERIFY**: Cursor correct in each terminal

### Test 4: WebGL Mode Testing (P2)
1. Open Settings > Appearance
2. Set Terminal Rendering to "Balanced"
3. Switch projects
4. **VERIFY**: Active terminal has WebGL (check DevTools Performance)
5. Set to "Quality"
6. **VERIFY**: All visible terminals have WebGL
7. Set to "Performance"
8. **VERIFY**: No WebGL for any terminal

### Test 5: Empty Project Switch (P1)
1. Create Project A with terminals
2. Create Project B (empty, no terminals)
3. Switch to Project B
4. **VERIFY**: Empty state screen shows
5. Switch back to Project A
6. **VERIFY**: Terminals and cursor preserved

### Test 6: Terminal Close Then Switch (P2)
1. Create Project A with 2 terminals
2. Close one terminal
3. Switch to Project B
4. Switch back to Project A
5. **VERIFY**: Only 1 terminal remains
6. **VERIFY**: No ghost/orphaned terminals

### Test 7: Resize During Hidden (P2)
1. Create 2 projects with terminals
2. Switch to Project B (Project A hidden)
3. Resize window significantly
4. Switch back to Project A
5. **VERIFY**: Terminal fits container correctly
6. **VERIFY**: No rendering artifacts

## E2E Test Verification

### Run Existing Tests
```bash
npm run test:ui
```

Expected: All existing E2E tests pass (terminal, project, settings)

### Key Tests to Watch
- Terminal creation tests
- Project switching tests
- Keyboard shortcut tests (Alt+1-9)
- Visual regression tests

## Console Verification

### Expected: No Errors
Open DevTools Console during testing. Should NOT see:
- `WebGL context lost` errors
- `dispose()` called on unmounted terminal
- React key warnings
- `Cannot read property of undefined` errors

### Expected: No Terminal Unmount Logs
If debug logging added in Phase 3:
```
// Should NOT see during project switch:
[Terminal] Unmounting terminal-xxx
[Terminal] Disposing xterm instance

// SHOULD see:
[WebGL Toggle] terminalId=xxx isHidden=true needsWebGL=false hasWebGL=true
[WebGL Toggle] terminalId=xxx isHidden=false needsWebGL=true hasWebGL=false
```

## Performance Verification

### Memory Check
1. Open DevTools > Performance > Memory
2. Create 3 projects with 3 terminals each (9 total)
3. Switch between projects 10 times
4. **VERIFY**: Memory stable (no continuous growth)
5. **VERIFY**: No significant increase vs. before fix

### GPU Check
1. Open DevTools > Performance
2. Switch projects rapidly
3. **VERIFY**: No GPU memory spikes
4. **VERIFY**: WebGL disposal happens for hidden terminals

## Regression Testing

### Things That Should Still Work
- [ ] Creating new terminal (Ctrl+T)
- [ ] Closing terminal (Ctrl+W)
- [ ] Terminal title editing
- [ ] Copy/paste in terminal
- [ ] Smart scroll behavior
- [ ] Terminal resize handles
- [ ] Theme switching
- [ ] Settings modal
- [ ] Project deletion (terminals cleanup)
- [ ] App quit (clean shutdown)

## Todo List

- [ ] Run Test 1: Basic Project Switch
- [ ] Run Test 2: Rapid Project Switching
- [ ] Run Test 3: Multiple Terminals Per Project
- [ ] Run Test 4: WebGL Mode Testing
- [ ] Run Test 5: Empty Project Switch
- [ ] Run Test 6: Terminal Close Then Switch
- [ ] Run Test 7: Resize During Hidden
- [ ] Run E2E tests (`npm run test:ui`)
- [ ] Check console for errors
- [ ] Verify memory stability
- [ ] Complete regression checklist

## Success Criteria

1. All 7 manual test scenarios pass
2. All E2E tests pass
3. No console errors during testing
4. Memory usage stable
5. Cursor position preserved in ALL scenarios
6. Buffer content preserved in ALL scenarios
7. Project switch is instant (no 150ms delay)

## Bug Report Template

If issues found, document with:

```markdown
## Issue: [Brief description]

**Steps to Reproduce:**
1. ...
2. ...

**Expected:** ...

**Actual:** ...

**Console Errors:** (if any)

**Screenshot:** (if visual issue)
```
