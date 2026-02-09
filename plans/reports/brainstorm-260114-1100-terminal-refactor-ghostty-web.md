# Brainstorm: Terminal Refactor - xterm.js vs ghostty-web

## Problem Statement

Current terminal implementation uses xterm.js with issues:
1. **Performance**: WebGL context lost, lag with multiple terminals
2. **Cursor jumps on resize**: Known issue during project switching
3. **Maintenance overhead**: WebGL management complexity

User requirement: **Full VT100 compatibility** (vim, htop, etc.)

---

## Current Implementation Analysis

### Features in use (use-terminal.ts, 662 LOC)

| Feature | Implementation |
|---------|---------------|
| Terminal emulation | XTerm core |
| WebGL rendering | @xterm/addon-webgl with context lost handling |
| Auto-resize | @xterm/addon-fit |
| Clickable URLs | @xterm/addon-web-links |
| Smart scroll | Custom viewport position tracking |
| Viewport save/restore | savedViewportRef for project switching |
| Theme sync | Dynamic theme updates |
| Render modes | Performance/Balanced/Quality |
| Custom key handlers | Shortcuts (Alt+1-9, Ctrl+N/T/W/V) |
| Auto-copy | Selection → clipboard |
| Right-click paste | Context menu → paste |
| Image paste | Clipboard image → temp file path |

### Pain Points Identified

1. **WebGL context management**: ~80 LOC for addon toggle/recovery
2. **Cursor jump on resize**: Lines 362-398, savedViewportRef logic has timing issues
3. **Complex lifecycle**: Dispose delays, RAF guards, debouncing

---

## Alternatives Evaluated

### 1. ghostty-web (Coder)

| Attribute | Value |
|-----------|-------|
| Package | `ghostty-web@0.4.0` |
| Publisher | Coder (coder-bot) |
| Repo | github.com/coder/ghostty-web |
| Last update | 2025-12-09 |
| Bundle | ~400KB WASM, zero deps |
| API | xterm.js compatible |

**Pros:**
- No WebGL → no context lost issues
- Same parser as native Ghostty (battle-tested)
- xterm.js API compatible → easier migration
- Better Unicode/grapheme handling

**Cons:**
- Early stage (v0.4.0), may have breaking changes
- Small community (only Coder)
- Larger bundle (400KB vs ~150KB)
- Missing addon ecosystem (fit, web-links)
- Unknown if cursor resize issue fixed

### 2. hterm (Google)

**Verdict:** Migration cost too high, different API, less active

### 3. Rio/WebGPU

**Verdict:** Not a library, desktop app only

### 4. Fix xterm.js

**Verdict:** Lower risk, known ecosystem, cursor issue likely fixable

---

## Recommended Approach: Parallel Strategy

### Track 1: Fix xterm.js Cursor Jump (Low risk)

**Root cause hypothesis:**
- `savedViewportRef` captures position but `scrollToLine()` timing may be off
- Font metrics not settled when fit() restores position
- Race between buffer reflow and viewport restore

**Investigation steps:**
1. Add timing logs to fit() → scrollToLine() flow
2. Test delaying scrollToLine() after fit() settles
3. Consider using RAF or requestIdleCallback for restore
4. Test with different buffer sizes

### Track 2: ghostty-web PoC (Medium risk)

**Goals:**
1. Install ghostty-web, verify basic functionality
2. Test cursor behavior on resize
3. Benchmark performance with 4+ terminals
4. Evaluate missing features (fit, web-links)

**PoC scope:**
- Create `use-terminal-ghostty.ts` parallel to existing
- Feature flag to switch between backends
- Compare behavior side-by-side

---

## Migration Path (if ghostty-web proves viable)

```
Phase 1: PoC + Validation (current)
Phase 2: Feature parity (implement missing addons)
Phase 3: Gradual rollout (feature flag)
Phase 4: Full migration
```

### Features requiring custom implementation:

| Feature | xterm.js | ghostty-web |
|---------|----------|-------------|
| Auto-resize | FitAddon | Custom (ResizeObserver) |
| Clickable URLs | WebLinksAddon | Custom (regex + handler) |
| WebGL toggle | WebglAddon | N/A (not needed) |

---

## Decision Matrix

| Criteria | Fix xterm.js | Migrate ghostty-web |
|----------|--------------|---------------------|
| Risk | Low | Medium |
| Effort | Low-Medium | Medium-High |
| Solves cursor issue | Maybe | Unknown |
| Solves WebGL issues | No | Yes |
| Long-term maintenance | Same | Potentially lower |
| Community support | Large | Small |

---

## Recommended Next Steps

1. **Immediate**: Fix xterm.js cursor jump (Track 1)
2. **Parallel**: Create ghostty-web PoC branch (Track 2)
3. **Evaluate**: After both tracks complete, decide migration path
4. **Fallback**: If ghostty-web doesn't solve issues, stay with fixed xterm.js

---

## Success Metrics

1. Cursor position preserved on resize/project switch
2. No WebGL context lost errors
3. Consistent performance with 4+ terminals
4. All existing features working

---

## Unresolved Questions

1. Does ghostty-web have fit/resize API?
2. Does ghostty-web handle cursor position on resize correctly?
3. Performance comparison: WASM vs WebGL for rendering?
4. ghostty-web roadmap stability?
