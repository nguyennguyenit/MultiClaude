# Research Report: xterm.js Cursor Visibility Issues

**Research Date:** 2026-01-15
**Focus Areas:** WebGL addon, terminal resize, CSS display:none effects, multi-terminal management
**Context:** Multi-terminal Electron app with Claude Code CLI integration

---

## Executive Summary

Cursor disappearing in xterm.js is a **known, multi-faceted issue** particularly affecting WebGL renderer implementations. Primary root causes identified:

1. **WebGL context loss** during terminal hide/show cycles (CSS display:none)
2. **Focus management failures** after DOM manipulation
3. **Render suspension** needed when hiding terminals (not just CSS hiding)
4. **ANSI sequences insufficient** - programmatic API calls required

**Critical Finding:** Using CSS `display:none` to hide terminals is **anti-pattern**. Terminals continue rendering in background, causing resource drain AND cursor state corruption. Solution requires **pause/resume rendering API** + proper **WebGL lifecycle management**.

---

## Research Methodology

- **Sources consulted:** 5 parallel deep-dive searches
- **Date range:** 2022-2026 (prioritizing 2024-2025)
- **Key repositories:** xtermjs/xterm.js GitHub issues, Stack Overflow, official docs
- **Search terms:** cursor visibility, WebGL addon, resize bugs, display:none, focus management, Electron integration

---

## Key Findings

### 1. Known GitHub Issues - Cursor Disappears After Resize

**Issue #1120:** Cursor location improper on window resize
- **Root cause:** Misalignment between xterm.js and underlying PTY resize synchronization
- **Solution:** Ensure PTY resized synchronously with xterm.js instance
- **Related:** #622 (fixed), but symptoms can reappear if PTY communication lag exists

**Issue #3179:** Cursor position doesn't adapt to text height after resize
- **Root cause:** PTY not resized in sync → "random output bugs"
- **Solution:** Synchronous resize of PTY with terminal instance

**Issue #3178:** Resizing causes text loss
- **Solution:** **Debounce/throttle resize events** sent to PTY to prevent rapid, problematic operations

**Verdict:** Resize-related cursor bugs mostly **resolved in modern versions** IF proper PTY synchronization maintained.

---

### 2. WebGL Addon Cursor Visibility Issues

#### Issue #3364: Serialize addon ignores cursor visibility
- **Impact:** Cursor visibility state NOT preserved during serialization/deserialization
- **Workaround:** Manually track cursor visibility state separately from serialize addon

#### Issue #2614: Cursor render layer architecture in WebGL
- **Technical detail:** Cursor drawn on **separate transparent 2D canvas** overlaying WebGL canvas
- **Implication:** Cursor rendering follows different lifecycle than main terminal content
- **Future:** Discussion to merge into single canvas for consistency

#### Issue #891: Cursor not visible initially (xterm 3.0)
- **Symptom:** Cursor invisible until terminal receives focus
- **Solution:** Explicitly call `terminal.focus()` after initialization or when terminal becomes visible
- **Status:** Closed in newer versions, but **pattern still recommended**

#### Cursor Blinking Bug (Subsequently Created Terminals)
- **Problem:** Older versions - cursor blink broken for terminals created after first instance
- **Root cause:** `CursorBlinkStateManager` not initialized for subsequent WebGL renderers
- **Status:** **FIXED** in xterm.js ^5.5.0 and xterm-addon-webgl ^0.18.0
- **Action:** Verify using latest versions

#### Cursor with Ligatures (Issue #5205, #3303)
- **Problem:** Cursor appears "stuck" at end of ligatures with WebGL renderer
- **Status:** **UNRESOLVED ongoing issue** as of Jan 2026
- **Workaround:** Switch to Canvas renderer OR disable ligatures if API allows

---

### 3. Common Solutions for Cursor Disappearing

#### Solution A: WebGL Context Loss Handling

**Critical:** WebGL contexts can be lost (OOM, system suspension, GPU driver issues)

```javascript
import { Terminal } from 'xterm';
import { WebglAddon } from 'xterm-addon-webgl';

const terminal = new Terminal();
const webglAddon = new WebglAddon();

webglAddon.onContextLoss(() => {
  console.warn('WebGL context lost. Disposing WebGL addon.');
  webglAddon.dispose();

  // Option 1: Reload WebGL addon
  terminal.loadAddon(new WebglAddon());

  // Option 2: Fallback to Canvas renderer
  // import { CanvasAddon } from 'xterm-addon-canvas';
  // terminal.loadAddon(new CanvasAddon());
});

terminal.loadAddon(webglAddon);

// CRITICAL: Dispose when terminal hidden/destroyed
// webglAddon.dispose();
// terminal.dispose();
```

**Advanced Recovery Pattern:**

```javascript
const canvas = terminal.element.querySelector('canvas');

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); // Prevent default context loss handling
  console.warn('WebGL context lost');
});

canvas.addEventListener('webglcontextrestored', () => {
  console.log('WebGL context restored');
  // Re-initialize WebGL resources:
  // - Recompile shaders
  // - Reload textures
  // - Restore GL state
  // - Re-establish WebGL context
});
```

#### Solution B: Focus Management After DOM Manipulation

**Pattern:** Always call `terminal.focus()` after showing hidden terminal

```javascript
// BAD PATTERN - CSS display:none
terminalContainer.style.display = 'none'; // Terminal still rendering!
// ... later ...
terminalContainer.style.display = 'flex';
terminal.focus(); // Cursor may still be broken
```

**BETTER PATTERN - Pause/Resume + Focus:**

```javascript
// When hiding terminal
// Note: Pause/resume rendering API (check xterm.js version for availability)
terminal.pauseRendering?.(); // Stop rendering loop
terminalContainer.style.display = 'none';
webglAddon.dispose(); // Release WebGL resources

// When showing terminal
terminalContainer.style.display = 'flex';
webglAddon = new WebglAddon();
terminal.loadAddon(webglAddon);
terminal.resumeRendering?.(); // Resume rendering
terminal.focus(); // Force cursor visibility
```

#### Solution C: FitAddon Integration

**Issue:** Cursor can disappear after container size changes

```javascript
import { FitAddon } from 'xterm-addon-fit';

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

// After DOM manipulation or resize
window.addEventListener('resize', () => {
  fitAddon.fit(); // Recalculate terminal dimensions
  terminal.focus(); // Re-ensure cursor visibility
});

// When showing previously hidden terminal
terminalContainer.style.display = 'flex';
fitAddon.fit();
terminal.focus(); // CRITICAL for cursor visibility
```

#### Solution D: Renderer Fallback Strategy

```javascript
const terminal = new Terminal({
  cursorBlink: true,
  cursorStyle: 'block',
  cursorInactiveStyle: 'outline'
});

terminal.open(document.getElementById('terminal-container'));

try {
  const webglAddon = new WebglAddon();
  terminal.loadAddon(webglAddon);
  console.log('Using WebGL renderer');
} catch (e) {
  console.warn('WebGL not supported, falling back to Canvas', e);
  const canvasAddon = new CanvasAddon();
  terminal.loadAddon(canvasAddon);
}

terminal.focus();
```

---

### 4. Programmatic Cursor Visibility Control

#### API Methods (Beyond ANSI Sequences)

**ITerminalOptions Configuration:**

```typescript
const terminal = new Terminal({
  cursorBlink: true,           // Enable blinking
  cursorStyle: 'block',        // 'block' | 'bar' | 'underline'
  cursorWidth: 5,              // Only for 'bar' style
  cursorInactiveStyle: 'outline', // 'outline' | 'block' | 'bar' | 'underline' | 'none'
  cursorBlinkInterval: 530     // Blink speed in ms
});
```

**Dynamic Option Changes:**

```typescript
// Change options at runtime
terminal.options.cursorBlink = false; // Disable blinking
terminal.options.cursorStyle = 'bar'; // Change to bar cursor
terminal.options.cursorInactiveStyle = 'none'; // Hide when inactive
```

#### Refresh Methods

**`terminal.refresh(startRow, endRow)`:**
- Redraws specified row range
- Does NOT directly control visibility
- Cursor redrawn IF visibility state is true
- Useful after manual buffer manipulation

**`terminal.focus()`:**
- **PRIMARY METHOD** for forcing cursor visibility
- Brings terminal into focus
- Makes cursor active and visible
- **MUST be called** after DOM manipulation

**`terminal.write(data)`:**
- Writing data implicitly triggers redraw
- ANSI codes can control cursor position/appearance
- Example: `terminal.write('\x1b[?25h')` - show cursor (ANSI)
- Example: `terminal.write('\x1b[?25l')` - hide cursor (ANSI)

**`terminal.reset()`:**
- Hard reset of terminal state
- Cursor returns to home position (top-left)
- Resets cursor style to defaults
- Clears buffer and resets modes

#### ANSI Escape Codes (Still Relevant)

```javascript
// Show cursor
terminal.write('\x1b[?25h');

// Hide cursor
terminal.write('\x1b[?25l');

// Set cursor style (CSI Ps SP q)
terminal.write('\x1b[?1 q'); // Blinking block
terminal.write('\x1b[?2 q'); // Steady block
terminal.write('\x1b[?3 q'); // Blinking underline
terminal.write('\x1b[?4 q'); // Steady underline
terminal.write('\x1b[?5 q'); // Blinking bar
terminal.write('\x1b[?6 q'); // Steady bar
```

**Important:** ANSI sequences alone **insufficient** if cursor disappears due to:
- Focus loss
- WebGL context loss
- DOM manipulation breaking render state

---

### 5. Multi-Terminal Management Best Practices

#### Anti-Pattern: CSS display:none

**Problem:** Terminal continues rendering when `display:none` applied
- Wastes CPU/GPU resources
- Drains battery
- Can corrupt cursor state
- WebGL context remains active

#### Recommended Pattern: Disposal and Recreation

```javascript
// Terminal lifecycle manager
class TerminalManager {
  terminals = new Map();

  hideTerminal(id) {
    const term = this.terminals.get(id);
    if (!term) return;

    // Serialize state if needed
    const state = serializeAddon.serialize();

    // Properly dispose
    term.webglAddon?.dispose();
    term.terminal.dispose();

    // Store state for restoration
    this.terminalStates.set(id, state);
    this.terminals.delete(id);
  }

  showTerminal(id, container) {
    const state = this.terminalStates.get(id);

    // Create fresh terminal instance
    const terminal = new Terminal({ /* options */ });
    const webglAddon = new WebglAddon();
    const fitAddon = new FitAddon();

    terminal.loadAddon(webglAddon);
    terminal.loadAddon(fitAddon);

    // Restore state BEFORE opening
    if (state) {
      terminal.write(state); // Restore from serialized state
    }

    terminal.open(container);
    fitAddon.fit();
    terminal.focus(); // CRITICAL for cursor

    this.terminals.set(id, { terminal, webglAddon, fitAddon });
  }
}
```

#### State Preservation with Serialize Addon

```javascript
import { SerializeAddon } from '@xterm/addon-serialize';

const serializeAddon = new SerializeAddon();
terminal.loadAddon(serializeAddon);

// Before disposing/hiding
const terminalState = serializeAddon.serialize();

// After recreating terminal (BEFORE terminal.open())
const newTerminal = new Terminal({
  cols: oldCols, // Must match original dimensions
  rows: oldRows
});
newTerminal.write(terminalState); // Restore state
newTerminal.open(container);
newTerminal.focus();
```

**Caveat:** Serialize addon does NOT preserve cursor visibility state (Issue #3364)
**Workaround:** Track cursor visibility separately

---

### 6. Electron-Specific Considerations

#### Known Issues in Electron

**Performance Degradation:**
- xterm.js can be slower in Electron vs browser
- PTY stream directly queried → potential bottleneck

**GPU Acceleration Conflicts:**
```javascript
// main.js (Electron main process)
import { app } from 'electron';

// Option 1: Disable hardware acceleration
app.disableHardwareAcceleration();

// Option 2: Launch with flag
// electron . --disable-gpu
```

**When to Disable GPU:**
- Cursor rendering artifacts
- WebGL context loss issues
- Terminal flickering
- Rendering performance worse than expected

#### node-pty Integration Pattern

```javascript
// Main process
import * as pty from 'node-pty';
import { ipcMain } from 'electron';

const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env
});

ptyProcess.onData(data => {
  mainWindow.webContents.send('terminal-data', data);
});

ipcMain.on('terminal-input', (event, data) => {
  ptyProcess.write(data);
});

ipcMain.on('terminal-resize', (event, { cols, rows }) => {
  ptyProcess.resize(cols, rows); // Synchronous resize
});

// Renderer process
import { ipcRenderer } from 'electron';

terminal.onData(data => {
  ipcRenderer.send('terminal-input', data);
});

terminal.onResize(({ cols, rows }) => {
  ipcRenderer.send('terminal-resize', { cols, rows });
});

ipcRenderer.on('terminal-data', (event, data) => {
  terminal.write(data);
});
```

---

## Comparative Analysis: Canvas vs WebGL Renderers

| Aspect | Canvas Renderer | WebGL Renderer |
|--------|----------------|----------------|
| **Performance** | Lower (CPU-bound) | Higher (GPU-accelerated) |
| **Cursor Rendering** | Direct 2D context | Separate 2D canvas overlay |
| **Context Loss** | N/A | Requires handling |
| **Ligature Support** | Better cursor behavior | Known cursor "stuck" bug |
| **Resource Usage** | Moderate CPU | Lower CPU, GPU dependent |
| **Electron Compatibility** | Excellent | Can have GPU conflicts |
| **Stability** | More stable | Requires lifecycle management |
| **Best For** | Electron apps, compatibility | High-performance web apps |

---

## Implementation Recommendations

### For Your Multi-Terminal Electron App

**Immediate Actions:**

1. **Replace CSS display:none pattern** with proper disposal/recreation
2. **Implement WebGL context loss handling** with fallback to Canvas
3. **Always call `terminal.focus()`** after showing terminal
4. **Use FitAddon** and call `fit()` + `focus()` after layout changes
5. **Consider disabling GPU acceleration** if cursor issues persist

**Code Template for Terminal Switching:**

```javascript
class MultiTerminalApp {
  currentTerminal = null;
  terminals = new Map(); // projectId -> terminalState

  async switchProject(newProjectId) {
    // 1. Save current terminal state
    if (this.currentTerminal) {
      const state = this.serializeAddon.serialize();
      this.terminals.set(this.currentProjectId, {
        state,
        cols: this.currentTerminal.cols,
        rows: this.currentTerminal.rows
      });

      // 2. Dispose properly
      this.webglAddon?.dispose();
      this.currentTerminal.dispose();
    }

    // 3. Create/restore terminal for new project
    const savedState = this.terminals.get(newProjectId);

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      cursorInactiveStyle: 'outline'
    });

    // Load addons
    this.webglAddon = new WebglAddon();
    this.fitAddon = new FitAddon();
    this.serializeAddon = new SerializeAddon();

    // Handle WebGL context loss
    this.webglAddon.onContextLoss(() => {
      console.warn('WebGL lost, reloading addon');
      this.webglAddon.dispose();
      this.webglAddon = new WebglAddon();
      terminal.loadAddon(this.webglAddon);
      terminal.focus(); // Force cursor redraw
    });

    terminal.loadAddon(this.webglAddon);
    terminal.loadAddon(this.fitAddon);
    terminal.loadAddon(this.serializeAddon);

    // Restore state BEFORE opening (if exists)
    if (savedState?.state) {
      terminal.write(savedState.state);
    }

    // 4. Open and focus
    const container = document.getElementById('terminal-container');
    terminal.open(container);
    this.fitAddon.fit();

    // 5. CRITICAL: Focus to ensure cursor visible
    terminal.focus();

    // 6. Force cursor visibility via ANSI (belt-and-suspenders)
    terminal.write('\x1b[?25h');

    this.currentTerminal = terminal;
    this.currentProjectId = newProjectId;
  }
}
```

### Debugging Checklist

When cursor disappears:

- [ ] Call `terminal.focus()` explicitly
- [ ] Check WebGL context status (not lost)
- [ ] Verify terminal element has non-zero dimensions
- [ ] Confirm no conflicting CSS hiding cursor
- [ ] Try disabling GPU acceleration
- [ ] Switch to Canvas renderer temporarily
- [ ] Check if ANSI cursor hide sequence sent (`\x1b[?25l`)
- [ ] Verify PTY and terminal dimensions synchronized
- [ ] Test with `cursorBlink: false` to isolate blink bugs
- [ ] Inspect DOM - cursor element should exist in terminal

---

## Resources & References

### Official Documentation
- [xterm.js API - ITerminalOptions](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/)
- [xterm.js API - Terminal.write()](https://xtermjs.org/docs/api/terminal/classes/terminal/#write)
- [xterm.js API - Terminal.refresh()](https://xtermjs.org/docs/api/terminal/classes/terminal/#refresh)
- [xterm.js API - Terminal.reset()](https://xtermjs.org/docs/api/terminal/classes/terminal/#reset)
- [WebGL Addon Documentation](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-webgl)
- [Serialize Addon Documentation](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-serialize)

### Key GitHub Issues
- [#1120 - Cursor location improper on resize](https://github.com/xtermjs/xterm.js/issues/1120)
- [#891 - Cursor not visible initially](https://github.com/xtermjs/xterm.js/issues/891)
- [#3364 - Serialize ignores cursor visibility](https://github.com/xtermjs/xterm.js/issues/3364)
- [#5205 - Cursor with ligatures (WebGL)](https://github.com/xtermjs/xterm.js/issues/5205)
- [#2614 - WebGL cursor render layer architecture](https://github.com/xtermjs/xterm.js/issues/2614)
- [#3179 - Cursor position resize bug](https://github.com/xtermjs/xterm.js/issues/3179)

### Community Resources
- Stack Overflow: [xterm.js tag](https://stackoverflow.com/questions/tagged/xterm.js)
- GitHub Discussions: [xtermjs/xterm.js discussions](https://github.com/xtermjs/xterm.js/discussions)

---

## Unresolved Questions

1. **Does your app's current implementation call `terminal.focus()` after project switch?**
   - If not, this is likely the primary issue

2. **Are you disposing WebGL addon before hiding terminals?**
   - Check if `webglAddon.dispose()` called in hide logic

3. **What xterm.js and addon versions are you using?**
   - Verify >= xterm.js 5.5.0 and xterm-addon-webgl 0.18.0

4. **Is GPU acceleration enabled in Electron?**
   - Try disabling with `app.disableHardwareAcceleration()`

5. **Are you using SerializeAddon for state preservation?**
   - If yes, cursor visibility must be tracked separately (addon bug #3364)

6. **Does cursor reappear if you:**
   - Click on terminal?
   - Type a character?
   - Send explicit `terminal.write('\x1b[?25h')`?
   - If yes to any → focus management issue, not renderer bug

---

## Next Steps

**Immediate (High Priority):**
1. Add `terminal.focus()` call after every project switch
2. Implement WebGL `onContextLoss` handler with reload/fallback
3. Replace CSS `display:none` with proper disposal/recreation pattern
4. Add `fitAddon.fit()` + `terminal.focus()` after container show

**Short Term:**
1. Implement state serialization for seamless project switching
2. Add debug logging for WebGL context loss events
3. Test with Canvas renderer as fallback option
4. Verify xterm.js versions up to date

**Long Term:**
1. Monitor GitHub issue #5205 (ligature cursor bug) for resolution
2. Consider contributing fix for SerializeAddon cursor visibility (#3364)
3. Implement performance monitoring for multi-terminal scenarios
4. Evaluate pause/resume rendering API when available

---

**Report Generated:** 2026-01-15
**Research Depth:** Comprehensive (5 parallel deep-dives)
**Confidence Level:** High (verified across official docs, GitHub issues, community discussions)
