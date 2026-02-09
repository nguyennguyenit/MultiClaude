# Phase 3: Testing & Validation

## Context Links

- [Parent Plan](./plan.md)
- [Phase 1: Smart Scroll](./phase-01-implement-smart-scroll.md)
- [Phase 2: Scroll Button](./phase-02-scroll-to-bottom-button.md)

## Overview

| Field | Value |
|-------|-------|
| Priority | P2 |
| Status | Complete |
| Effort | 30m |
| Description | Validate smart scroll and floating button behavior |

## Key Insights

1. Test both auto-scroll and preserve-position scenarios
2. Test floating button visibility and click behavior
3. Edge cases include rapid output, terminal resize, project switch
4. Build verification ensures no TypeScript errors

## Requirements

### Functional
- Verify auto-scroll works when at bottom
- Verify position preserved when scrolled up
- Verify floating button appears/disappears correctly
- Verify button click scrolls to bottom

### Non-Functional
- No build errors
- No console warnings/errors

## Test Scenarios

### Scenario 1: Normal Output Streaming

**Steps:**
1. Open terminal, stay at bottom
2. Run Claude command that generates long output
3. Observe terminal auto-scrolling

**Expected:** Terminal follows output, Yes/No prompt visible at end. Button NOT visible.

### Scenario 2: User Scrolls Up During Output

**Steps:**
1. Open terminal, run Claude command
2. While Claude generating output, scroll up
3. Wait for output to complete

**Expected:** Terminal stays at user's scroll position. Floating button APPEARS.

### Scenario 3: Floating Button Click

**Steps:**
1. Scroll up in terminal (button appears)
2. Click floating button
3. Observe scroll and button

**Expected:** Terminal scrolls to bottom. Button DISAPPEARS.

### Scenario 4: User Scrolls Back to Bottom Manually

**Steps:**
1. Scroll up in terminal (button appears)
2. Manually scroll back to bottom (mouse wheel)
3. Observe button

**Expected:** Button disappears when at bottom. Auto-scroll resumes.

### Scenario 5: Terminal Resize

**Steps:**
1. Have terminal with scrollback
2. Resize terminal panel
3. Observe scroll position and button

**Expected:** Scroll position preserved. Button state correct.

### Scenario 6: Project Switch

**Steps:**
1. Open terminal with output, scroll up
2. Switch to different project
3. Switch back

**Expected:** Terminal restores with correct scroll behavior.

## Todo List

- [x] Build project: `npm run build`
- [x] Test Scenario 1: Normal streaming (button hidden)
- [x] Test Scenario 2: Scroll up (button visible)
- [x] Test Scenario 3: Button click
- [x] Test Scenario 4: Manual scroll to bottom
- [x] Test Scenario 5: Terminal resize
- [x] Test Scenario 6: Project switch
- [x] Verify no console errors

## Bug Fixes During Testing

- Fixed xterm.js `onScroll` not firing for mouse wheel (added viewport scroll listener)
- Fixed button z-index conflict with Settings modal
- Fixed button showing when terminal not active

## Success Criteria

1. All 6 scenarios pass
2. Build succeeds without errors
3. Button visibility correct in all scenarios
4. No console warnings related to scroll
5. No performance degradation

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Edge case not covered | Low | Low | Add additional scenarios if discovered |
| Button overlaps content | Low | Low | Positioned in corner with padding |

## Security Considerations

None - testing only.

## Next Steps

After validation:
1. Mark plan as completed
2. Commit changes
3. Document in changelog if needed
