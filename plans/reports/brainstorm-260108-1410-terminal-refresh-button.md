# Brainstorm: Terminal Refresh Button + Auto-recovery

**Date:** 2026-01-08
**Status:** Approved → Ready for Planning

---

## Problem Statement

Terminal hiển thị bị lỗi mất chữ khi WebGL không active hoặc context lost. User hiện phải đóng/mở terminal để fix.

**Root cause:** WebGL context lost do GPU driver issues, resource exhaustion, hoặc tab switching.

---

## Requirements

1. **Manual Refresh Button**: Thay nút "Start Claude" bằng nút Refresh trong terminal header
2. **Auto-detect WebGL Context Lost**: Listen event và auto-recover
3. **Show Notification**: Toast message khi auto-recovery xảy ra

---

## Evaluated Approaches

### Approach 1: Manual Button Only
- Simple, ~20 LOC
- User phải tự nhận ra vấn đề
- **Rejected**: User muốn cả auto-detect

### Approach 2: Auto-detect Only
- Seamless UX
- WebGL context lost event không always fire
- **Rejected**: Cần manual backup

### Approach 3: Both Auto + Manual ✓ SELECTED
- Best of both worlds
- Manual button replaces Claude button
- Auto-detect as first line of defense
- Notification khi auto-recover

---

## Final Solution

### 1. Manual Refresh Button
- Location: Header bar, thay thế nút "Start Claude"
- Icon: Circular refresh arrow
- Action: Call `refresh()` from useTerminal

### 2. Auto-detect WebGL Context Lost
- Listen `webglcontextlost` on WebGL canvas
- Auto-call `refresh()` when detected
- Debounce 100ms để tránh spam

### 3. Refresh Logic (use-terminal.ts)
```typescript
refresh() {
  // 1. Dispose current WebGL addon
  webglAddonRef.current?.dispose()
  webglAddonRef.current = null

  // 2. Redraw all terminal rows
  terminalRef.current?.refresh(0, terminalRef.current.rows - 1)

  // 3. Re-init WebGL if needed
  if (shouldUseWebGL(isActiveRef.current)) {
    const webglAddon = new WebglAddon()
    webglAddonRef.current = webglAddon
    terminalRef.current.loadAddon(webglAddon)
  }

  // 4. Refit
  fitAddonRef.current?.fit()
}
```

### 4. Notification
- Use existing notification system
- Message: "Terminal display refreshed"

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/hooks/use-terminal.ts` | Add `refresh()`, listen webglcontextlost, emit notification event |
| `src/renderer/components/terminal/terminal-pane.tsx` | Replace Claude button with Refresh button |
| `src/renderer/components/terminal/terminal-view.tsx` | Pass refresh callback up to TerminalPane |

---

## Implementation Considerations

1. **WebGL context lost listener**: Attach after WebGL addon loads, cleanup on dispose
2. **Debounce**: Prevent rapid consecutive refreshes
3. **Guard disposed**: Check disposedRef before any operation
4. **Notification**: Use existing toast/notification system if available

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| webglcontextlost không fire | Medium | Low | Manual button backup |
| Refresh gây flicker | Low | Low | requestAnimationFrame |
| Spam refresh | Low | Medium | Debounce 100ms |

---

## Success Metrics

- [ ] Nút Refresh hiển thị và hoạt động
- [ ] Auto-detect khi WebGL context lost
- [ ] Notification hiển thị khi auto-refresh
- [ ] Terminal display phục hồi sau refresh
- [ ] Không memory leak khi refresh liên tục

---

## Next Steps

Create detailed implementation plan using `/plan:fast`.
