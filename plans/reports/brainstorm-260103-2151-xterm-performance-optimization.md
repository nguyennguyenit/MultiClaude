# Brainstorm: xterm.js Performance Optimization

## Problem Statement

Terminal lag when:
- Switching between multiple terminals/projects
- Multiple terminals open simultaneously

**Hardware**: Dedicated GPU (NVIDIA/AMD)
**Root cause**: Multiple WebGL contexts + terminal instances overhead

## Analysis

### Current Implementation Issues

1. **WebGL Context Limit**
   - Browser limits 8-16 concurrent WebGL contexts
   - Each terminal creates own WebGL context
   - Context recreation on switch causes lag

2. **Memory Pressure**
   - Each terminal holds ~1-2MB buffer
   - No cleanup strategy for hidden terminals

3. **No User Control**
   - Rendering mode hardcoded
   - No way to optimize for different hardware/use cases

## Evaluated Approaches

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Canvas-only | Stable, no context limits | Lower quality | ✅ Option |
| WebGL active only | Balanced | Medium complexity | ✅ Option |
| WebGL all (current) | Best quality | Lag with many terminals | ✅ Option |
| Migrate to hterm | Lighter | Migration risk, less ecosystem | ❌ Rejected |
| Custom renderer | Full control | High effort, bugs | ❌ Rejected |

## Recommended Solution

### User-configurable Terminal Rendering Mode

Add "Terminal Rendering" setting with 3 presets:

| Mode | WebGL Usage | Recommended For |
|------|-------------|-----------------|
| **Performance** | None (Canvas only) | Máy yếu, VM, 10+ terminals |
| **Balanced** ⭐ Default | Active terminal only | Đa số users |
| **Quality** | All terminals | GPU mạnh, ít terminals |

### Settings UI Design

```
Settings
└── Appearance
    └── Terminal Rendering: [Performance ▾] [Balanced ▾] [Quality ▾]
        └── Hint: "Balanced recommended. Use Performance if experiencing lag."
```

### Technical Implementation

#### 1. New Setting Type

```typescript
// src/shared/types/settings.ts
type TerminalRenderMode = 'performance' | 'balanced' | 'quality'

interface Settings {
  // existing...
  terminalRenderMode: TerminalRenderMode  // default: 'balanced'
}
```

#### 2. Rendering Logic

```typescript
// src/renderer/hooks/use-terminal.ts
const shouldUseWebGL = (terminalId: string, isActive: boolean): boolean => {
  const { terminalRenderMode } = useSettingsStore.getState().settings

  switch (terminalRenderMode) {
    case 'performance':
      return false  // Never use WebGL
    case 'balanced':
      return isActive  // Only active terminal
    case 'quality':
      return true  // All terminals
  }
}

// In initTerminal:
if (shouldUseWebGL(terminalId, isActive)) {
  try {
    terminal.loadAddon(new WebglAddon())
  } catch (e) {
    console.warn('WebGL failed, falling back to canvas')
  }
}
```

#### 3. Dynamic WebGL Toggle on Tab Switch

```typescript
// When terminal becomes active:
const onTerminalActivate = (terminalId: string) => {
  const mode = getSettings().terminalRenderMode
  if (mode === 'balanced') {
    // Add WebGL to newly active terminal
    loadWebGLAddon(terminalId)
    // Remove WebGL from previously active terminal
    unloadWebGLAddon(previousActiveId)
  }
}
```

#### 4. Settings UI Component

```tsx
// src/renderer/components/Settings.tsx
<SettingRow label="Terminal Rendering">
  <Select
    value={settings.terminalRenderMode}
    onChange={(v) => updateSetting('terminalRenderMode', v)}
  >
    <Option value="performance">Performance</Option>
    <Option value="balanced">Balanced (Recommended)</Option>
    <Option value="quality">Quality</Option>
  </Select>
  <Hint>Use Performance if experiencing lag with multiple terminals</Hint>
</SettingRow>
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types/settings.ts` | Add `terminalRenderMode` type |
| `src/renderer/stores/settings-store.ts` | Add default value |
| `src/renderer/hooks/use-terminal.ts` | Conditional WebGL loading |
| `src/renderer/components/Settings.tsx` | Add rendering mode selector |

### Implementation Complexity

| Component | Effort |
|-----------|--------|
| Types + Store | 30 min |
| WebGL conditional logic | 1-2 hours |
| Dynamic WebGL toggle (balanced mode) | 2-3 hours |
| Settings UI | 30 min |
| Testing | 1-2 hours |
| **Total** | **5-8 hours** |

## Success Metrics

- [ ] Settings UI shows 3 render mode options
- [ ] "Performance" mode: no WebGL contexts created
- [ ] "Balanced" mode: max 1 WebGL context at any time
- [ ] "Quality" mode: current behavior preserved
- [ ] No lag when switching between 10+ terminals in Performance/Balanced modes

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WebGL addon disposal issues | Proper cleanup on mode switch |
| Visual flicker during switch | Use requestAnimationFrame |
| Settings not persisting | Verify electron-store integration |

## Open Questions

1. Should we show current mode indicator in terminal tab bar?
2. Auto-detect and suggest mode based on terminal count?

---

*Report: 2026-01-03*
*Decision: User-configurable 3-preset rendering mode, default Balanced*
