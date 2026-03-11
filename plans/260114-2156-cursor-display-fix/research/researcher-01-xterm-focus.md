# xterm.js Cursor & Focus Behavior Research

**Date:** 2026-01-14
**Focus:** Terminal switching, cursor visibility, WebGL addon behavior

## Critical Findings

### 1. Hidden Cursor Problem (display:none)

**Issue:** When terminal hidden via CSS `display: none` or `visibility: hidden`, internal rendering engine may still consider cursor "active". Cursor can fail to reappear correctly when shown again.

**Root Cause:** Container layout collapsed, cursor state desynchronized from DOM visibility.

### 2. WebGL Addon Architecture

**Dual-Canvas System:**
- WebGL canvas: Main terminal rendering
- 2D overlay canvas: Cursor rendering (transparent overlay)
- Separation avoids full WebGL re-render every 600ms during blink cycle

**Known Issues:**
- **Visibility Latency:** Cursor may remain invisible on initial creation until first focus event
- **CursorBlinkStateManager Bug:** Fails to initialize for dynamically created terminals → frozen/missing cursor
- **Context Loss:** WebGL context loss (system suspend, memory pressure) breaks cursor without manual addon re-attachment
- **Rendering Artifacts:** WebGL layer remnants can obscure 2D cursor overlay

### 3. Focus State Management

**Manual Focus Required:**
- xterm.js does NOT auto-focus when container shown
- MUST explicitly call `terminal.focus()` when terminal becomes active
- Focus lost during React/Vue re-renders → must refocus after DOM stabilizes

**Resize Required:**
- ALWAYS call `terminal.resize()` or `FitAddon.fit()` immediately after terminal becomes visible
- xterm.js needs dimension recalculation if container size changed while hidden

### 4. Best Practice Solutions

#### A. ANSI Escape Code Approach (Most Robust)

```javascript
// Hide cursor explicitly
terminal.write('\x1b[?25l'); // DECTCEM - Private Mode Set 25 Low

// Show cursor explicitly
terminal.write('\x1b[?25h'); // DECTCEM - Private Mode Set 25 High
```

**Pattern for Terminal Switching:**
```javascript
function showTerminal(terminal, container) {
  container.style.display = 'block';
  terminal.write('\x1b[?25h'); // Explicit show
  terminal.focus();
  fitAddon.fit(); // Recalculate dimensions
}

function hideTerminal(terminal, container) {
  terminal.write('\x1b[?25l'); // Explicit hide
  container.style.display = 'none';
}
```

#### B. Configuration Options

```javascript
// Terminal initialization
{
  cursorStyle: 'block',           // Active cursor: block/underline/bar
  cursorInactiveStyle: 'outline', // Blurred cursor: outline/block/bar/none
  cursorBlink: true               // Blink behavior (WebGL addon dependent)
}
```

#### C. Event Handling

```javascript
// Track active terminal
terminal.onFocus(() => {
  // Mark as active in app state
});

terminal.onBlur(() => {
  terminal.clearSelection(); // Prevent ghost selections
});
```

### 5. WebGL Addon Considerations

**Package:** Use modern `@xterm/addon-webgl` (not deprecated `xterm-addon-webgl`)

**Context Loss Handling:**
```javascript
webglAddon.onContextLoss(() => {
  // Re-attach addon to recover
  webglAddon.dispose();
  const newAddon = new WebglAddon();
  terminal.loadAddon(newAddon);
});
```

**Disposal:** Dispose/pause addon if terminal hidden for long periods to prevent unnecessary rendering attempts.

### 6. Multiple Terminal Instance Management

**Pattern:**
- Maintain separate `Terminal` instances per session (don't swap single instance)
- Keep hidden containers in DOM with `display: none`
- Call `terminal.open(container)` if detaching/reattaching DOM nodes

**Scroll Position:** Manually restore scroll position if DOM manipulated in way that reset it.

## Recommendations for MultiClaude

### Primary Fix Strategy

1. **Add explicit cursor show on terminal switch:**
   ```javascript
   terminal.write('\x1b[?25h');
   terminal.focus();
   fitAddon.fit();
   ```

2. **Ensure WebGL addon compatibility:**
   - Verify using `@xterm/addon-webgl`
   - Handle context loss events
   - Re-instantiate addon if remounted

3. **Add dimension recalculation:**
   - Call `fitAddon.fit()` after visibility change
   - Ensures proper layout after `display: none` → `display: block`

4. **Optional: cursor hide on switch:**
   - `terminal.write('\x1b[?25l')` before hiding
   - Prevents ghost cursor states

### Testing Checklist

- [ ] Cursor visible after switching between terminals
- [ ] Cursor blinks correctly after switch
- [ ] Focus() called after DOM stabilizes
- [ ] Fit() recalculates dimensions post-visibility
- [ ] No ghost cursors on hidden terminals
- [ ] Works with WebGL addon enabled
- [ ] Handles rapid terminal switching

## Unresolved Questions

1. Does MultiClaude use WebGL addon? If yes, context loss handling needed?
2. Current timing of focus() call relative to DOM display change?
3. Is fitAddon.fit() called after terminal becomes visible?
4. Are terminals detached/reattached from DOM or just hidden with CSS?

## References

- xterm.js API: https://xtermjs.org/docs/api/terminal/
- ANSI Escape Codes: https://en.wikipedia.org/wiki/ANSI_escape_code
- VS Code Terminal (reference impl): https://github.com/microsoft/vscode/tree/main/src/vs/workbench/contrib/terminal
