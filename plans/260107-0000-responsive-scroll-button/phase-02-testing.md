# Phase 02: Testing

## Context

- Parent plan: [plan.md](./plan.md)
- Depends on: [Phase 01: Implementation](./phase-01-implementation.md)

## Overview

| Field | Value |
|-------|-------|
| Priority | P3 |
| Status | Done |
| Effort | 10m |
| Description | Manual testing of responsive scroll button across terminal layouts |

## Key Insights

- No unit tests needed (CSS-only change)
- Visual verification across grid configurations
- Test resize behavior during active resizing

## Requirements

### Functional
- Button visible on all terminal sizes
- Button clickable (≥20px)
- Button not oversized (≤32px)

### Non-Functional
- Smooth resize animation
- No layout shift
- No console errors

## Test Scenarios

### 1. Single Terminal (Full Width)
- Button should be ~32px (max bound)
- Verify clickable and centered icon

### 2. 2x2 Grid (4 Terminals)
- Button should be ~20-25px per terminal
- All 4 buttons visible and functional

### 3. 3x4 Grid (12 Terminals)
- Button should be 20px (min bound)
- Verify still clickable on small terminals

### 4. Window Resize
- Resize window while terminals visible
- Button should scale smoothly
- No jank or flicker

### 5. Terminal Tab Switch
- Switch between terminals
- Button appears/disappears correctly
- Size appropriate for each terminal

## Todo List

- [x] Test single terminal layout
- [x] Test 2x2 grid layout
- [x] Test 3x4 grid layout
- [x] Test window resize behavior
- [x] Test terminal tab switching
- [x] Verify no console errors

## Success Criteria

- All test scenarios pass
- Button scales correctly within 20-32px bounds
- No regressions in existing functionality

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Edge case layout issues | Low | Low | Test multiple configurations |

## Security Considerations

None - testing only.

## Next Steps

- If all tests pass → mark plan complete
- If issues found → iterate on Phase 01
