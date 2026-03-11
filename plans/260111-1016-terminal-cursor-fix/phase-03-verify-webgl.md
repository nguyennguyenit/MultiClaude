---
parent: ./plan.md
status: pending
priority: P2
effort: 30m
---

# Phase 3: Verify WebGL Toggle

## Overview

Verify that the existing WebGL toggle behavior in `use-terminal.ts` works correctly with the new single-parent pattern. Hidden terminals should still have WebGL disabled to save GPU resources.

## Context Links

- [Parent Plan](./plan.md)
- [Phase 1: Restructure Grid](./phase-01-restructure-grid.md)

## Key Insights

1. **WebGL toggle already exists** - `shouldUseWebGL()` returns false when `isHidden=true`
2. **Hidden prop flow**: TerminalGrid -> TerminalPane -> TerminalView -> useTerminal
3. **Expected behavior**: When project switches, `hidden` prop changes from false->true for old project terminals
4. **WebGL effect (lines 507-562)** should fire and dispose WebGL for newly hidden terminals

## Related Files

- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts` - Lines 44-57, 507-562
- `/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-view.tsx` - Prop passing

## Current WebGL Logic (Already Correct)

### shouldUseWebGL function (lines 44-57)
```tsx
function shouldUseWebGL(isActive: boolean, isHidden: boolean): boolean {
  // Never use WebGL for hidden terminals (saves GPU resources)
  if (isHidden) return false

  const mode = useSettingsStore.getState().settings.terminalRenderMode ?? 'balanced'
  switch (mode) {
    case 'performance':
      return false
    case 'balanced':
      return isActive
    case 'quality':
      return true
  }
}
```

### WebGL toggle effect (lines 507-562)
```tsx
useEffect(() => {
  isActiveRef.current = isActive
  isHiddenRef.current = isHidden
  if (!terminalRef.current || disposedRef.current) return

  // Clear pending toggle
  if (webglToggleTimerRef.current) {
    clearTimeout(webglToggleTimerRef.current)
    webglToggleTimerRef.current = null
  }

  const toggleWebGL = () => {
    if (disposedRef.current || !terminalRef.current || webglLoadingRef.current) return

    const needsWebGL = shouldUseWebGL(isActiveRef.current, isHiddenRef.current)
    const hasWebGL = webglAddonRef.current !== null

    if (needsWebGL && !hasWebGL) {
      // Load WebGL addon
      webglLoadingRef.current = true
      requestAnimationFrame(() => { ... })
    } else if (!needsWebGL && hasWebGL) {
      // Dispose WebGL addon
      try { webglAddonRef.current?.dispose() } catch { }
      webglAddonRef.current = null
    }
  }

  // Debounce toggle to handle rapid tab switching
  webglToggleTimerRef.current = setTimeout(toggleWebGL, WEBGL_TOGGLE_DEBOUNCE)

  return () => { ... }
}, [isActive, isHidden, attachContextLostListener])
```

## Verification Steps

### 1. Check prop flow
Trace that `hidden` prop correctly flows from TerminalGrid to useTerminal:
- `TerminalGrid` sets `hidden={!group.isActive}` on TerminalPane
- `TerminalPane` passes `hidden` prop to TerminalView
- `TerminalView` passes `isHidden={hidden}` to useTerminal hook

### 2. Add debug logging (temporary)
```tsx
// In useTerminal, add to toggleWebGL function:
console.log(`[WebGL Toggle] terminalId=${terminalId} isHidden=${isHiddenRef.current} needsWebGL=${needsWebGL} hasWebGL=${hasWebGL}`)
```

### 3. Test scenario
1. Create Project A with terminal (has WebGL if balanced/quality mode)
2. Create Project B with terminal
3. Switch to Project B
4. Verify Project A terminal's WebGL is disposed (no console errors)
5. Switch back to Project A
6. Verify Project A terminal's WebGL is restored

### 4. Check for race conditions
- Rapid project switching (10 times in 2 seconds)
- WebGL should not throw errors
- Only active project terminals should have WebGL

## Todo List

- [ ] Trace prop flow from TerminalGrid to useTerminal
- [ ] Add temporary debug logging
- [ ] Test single project (WebGL enabled for active terminal)
- [ ] Test multi-project switch (WebGL disabled for hidden)
- [ ] Test rapid switching (no WebGL errors)
- [ ] Remove debug logging
- [ ] Document any issues found

## Expected Behavior Matrix

| Scenario | Active? | Hidden? | Render Mode | WebGL? |
|----------|---------|---------|-------------|--------|
| Active terminal, active project | true | false | balanced | YES |
| Inactive terminal, active project | false | false | balanced | NO |
| Any terminal, hidden project | any | true | balanced | NO |
| Active terminal, active project | true | false | performance | NO |
| Any terminal | any | any | quality | YES (if not hidden) |

## Code Changes (If Needed)

### No changes expected

The current implementation should work correctly. The effect already watches `isHidden` as a dependency and toggles WebGL accordingly.

### Potential issue: isHidden not updating

If WebGL is not toggled, check that TerminalView re-renders with new `hidden` prop:

```tsx
// In terminal-view.tsx, verify prop is passed:
<TerminalView
  terminalId={terminalId}
  hidden={hidden}  // <-- Ensure this updates on project switch
  ...
/>

// In useTerminal hook:
export function useTerminal({ ..., isHidden = false, ... }: UseTerminalOptions) {
  // isHidden in dependency array of effect
}
```

## Success Criteria

1. Hidden terminals have no WebGL addon loaded
2. Visible terminals have WebGL (based on render mode)
3. No WebGL errors on project switch
4. GPU memory usage decreases when terminals hidden
5. No visual glitches when switching projects

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WebGL not toggling | Low | Medium | Debug logging, verify prop flow |
| WebGL disposal race | Low | Low | Existing debounce (50ms) handles this |
| Memory leak (WebGL not disposed) | Low | Medium | Monitor DevTools Performance |
