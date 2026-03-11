# Phase 4: Testing & Polish

## Objective

Verify implementation works correctly across all modes and edge cases.

## Manual Testing Checklist

### 4.1 Basic Functionality

- [ ] **Settings UI**: Terminal Rendering section appears in Settings → Appearance
- [ ] **Default Value**: Fresh install defaults to "Balanced" mode
- [ ] **Persistence**: Setting persists after app restart
- [ ] **Visual Feedback**: Selected mode shows accent color highlight

### 4.2 Performance Mode Testing

- [ ] Open 5+ terminals
- [ ] Verify no WebGL contexts in DevTools (F12 → More tools → Layers)
- [ ] Switch between terminals - should be smooth, no lag
- [ ] Terminal text renders correctly (may be slightly less crisp)

### 4.3 Balanced Mode Testing

- [ ] Open 5+ terminals
- [ ] Verify only 1 WebGL context exists (active terminal)
- [ ] Switch tabs - WebGL should transfer to new active terminal
- [ ] No console errors during tab switching
- [ ] No visual glitches during WebGL toggle

### 4.4 Quality Mode Testing

- [ ] Open 5+ terminals
- [ ] Verify multiple WebGL contexts (one per terminal)
- [ ] Behavior matches previous app version
- [ ] May experience lag with many terminals (expected)

### 4.5 Edge Cases

- [ ] **Mode Switch While Running**: Change mode with terminals open - no crash
- [ ] **Rapid Tab Switching**: Fast switching in balanced mode - no errors
- [ ] **Terminal Close**: Closing terminal properly disposes WebGL addon
- [ ] **Project Switch**: Switching projects handles WebGL correctly

### 4.6 Regression Testing

- [ ] Terminal input works (typing, paste, special keys)
- [ ] Terminal output renders correctly (colors, cursor, scrolling)
- [ ] Terminal resize works (window resize, panel resize)
- [ ] Theme changes apply to terminal
- [ ] Copy/paste functionality works
- [ ] Drag-drop file path works

## How to Verify WebGL Contexts

1. Open DevTools (F12)
2. Press Ctrl+Shift+P (Command Palette)
3. Type "Layers" and select "Show Layers"
4. Look for WebGL layer count
5. OR check console for "WebGL" related logs

## Debugging Tips

### If WebGL fails to load
```javascript
// Add to use-terminal.ts for debugging
console.log('WebGL decision:', {
  mode: terminalRenderMode,
  isActive,
  shouldUse: shouldUseWebGL(isActive)
})
```

### If WebGL toggle causes issues
```javascript
// Check addon state
console.log('WebGL addon ref:', webglAddonRef.current)
```

### If settings don't persist
```javascript
// Check localStorage
console.log(localStorage.getItem('multiclaude-settings'))
```

## Performance Benchmarks

Run these tests to validate improvement:

| Scenario | Before (Quality) | After (Performance) | After (Balanced) |
|----------|------------------|---------------------|------------------|
| Open 10 terminals | ~2-3s lag | <500ms | <500ms |
| Switch between tabs | Noticeable delay | Instant | Minimal delay |
| Memory usage (10 terms) | ~200MB | ~100MB | ~120MB |

## Polish Items (Optional)

### 4.7 UX Improvements (Low Priority)

- [ ] Add tooltip explaining each mode in detail
- [ ] Show current mode indicator in status bar
- [ ] Auto-suggest Performance mode when terminal count > 8
- [ ] Add keyboard shortcut to cycle modes (Ctrl+Shift+R)

## Sign-off Criteria

Before marking feature complete:

1. ✅ All 3 modes work as documented
2. ✅ No console errors during normal usage
3. ✅ Setting persists across restarts
4. ✅ No regression in existing terminal features
5. ✅ Performance improvement measurable in Performance/Balanced modes

---

*Phase 4 of 4*
