# Terminal Rendering Mode Implementation Plan

status: completed
completed: 2026-01-03

## Overview

Add user-configurable terminal rendering mode to optimize xterm.js performance for different use cases.

**Problem**: Terminal lag when switching between multiple terminals/projects due to WebGL context limits.

**Solution**: 3-preset rendering mode setting (Performance/Balanced/Quality) in Settings.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Settings Store                          │
│  terminalRenderMode: 'performance' | 'balanced' | 'quality' │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    use-terminal.ts                           │
│  shouldUseWebGL(terminalId, isActive) → boolean             │
│  - performance: always false                                 │
│  - balanced: only if isActive                                │
│  - quality: always true                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    WebGL Addon                               │
│  - Conditionally loaded based on shouldUseWebGL()           │
│  - Dynamic toggle on tab switch (balanced mode)             │
└─────────────────────────────────────────────────────────────┘
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/shared/types/index.ts` | MODIFY | Add `TerminalRenderMode` type, extend `AppSettings` |
| `src/shared/constants/themes.ts` | MODIFY | Add default value for new setting |
| `src/renderer/stores/settings-store.ts` | MODIFY | Add setter for `terminalRenderMode` |
| `src/renderer/hooks/use-terminal.ts` | MODIFY | Conditional WebGL loading logic |
| `src/renderer/components/terminal/terminal-view.tsx` | MODIFY | Pass `isActive` to hook for balanced mode |
| `src/renderer/components/settings/theme-selector.tsx` | MODIFY | Add rendering mode selector UI |

## Phases

- **Phase 1**: Types & Store (Foundation)
- **Phase 2**: WebGL Conditional Logic (Core feature)
- **Phase 3**: Settings UI (User interface)
- **Phase 4**: Testing & Polish

## Success Criteria

- [ ] Settings UI shows 3 render mode options
- [ ] "Performance" mode: no WebGL contexts created
- [ ] "Balanced" mode: max 1 WebGL context at any time
- [ ] "Quality" mode: current behavior preserved
- [ ] Setting persists across app restarts
- [ ] No lag when switching between 10+ terminals in Performance/Balanced modes

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WebGL addon lifecycle issues | Track addon ref, proper dispose on mode switch |
| Visual flicker during switch | Use requestAnimationFrame for smooth transition |
| Balanced mode toggle timing | Debounce toggle, ensure cleanup before new load |

---

*Created: 2026-01-03*
*Reference: plans/reports/brainstorm-260103-2151-xterm-performance-optimization.md*
