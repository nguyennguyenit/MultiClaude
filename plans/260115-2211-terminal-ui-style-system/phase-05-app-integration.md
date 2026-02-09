# Phase 05: App Integration

## Context
- Parent: [plan.md](./plan.md)
- Depends on: Phase 01, 02, 03, 04

## Overview
- **Priority**: High
- **Status**: Complete ✅ 2026-01-18
- **Effort**: 1h
- **Description**: Apply terminal classes to HTML element and sync font variable

## Key Insights
- Apply classes to `<html>` element like existing theme system
- Classes: ui-terminal, terminal-preset-{green|blue|white}, use-border-chars
- Update --mc-terminal-font CSS variable based on selected font
- Use existing pattern from App.tsx lines 216-237

## Requirements

### Functional
- Apply .ui-terminal when uiStyle === 'terminal'
- Apply .terminal-preset-{preset} for color
- Apply .use-border-chars when enabled
- Set --mc-terminal-font variable for selected font
- Live preview in settings modal

### Non-Functional
- No flicker on initial load
- Smooth transition between modes

## Architecture

```tsx
// App.tsx class logic
useEffect(() => {
  const html = document.documentElement

  // Existing theme logic...

  // Terminal style logic
  if (settings.uiStyle === 'terminal') {
    html.classList.add('ui-terminal')
    html.classList.add(`terminal-preset-${settings.terminalStyleOptions.colorPreset}`)
    if (settings.terminalStyleOptions.useBorderChars) {
      html.classList.add('use-border-chars')
    }
    // Set font variable
    const font = TERMINAL_FONTS.find(f => f.id === settings.terminalStyleOptions.fontFamily)
    html.style.setProperty('--mc-terminal-font', font?.family || "'JetBrains Mono', monospace")
  } else {
    html.classList.remove('ui-terminal', 'terminal-preset-green', 'terminal-preset-blue', 'terminal-preset-white', 'use-border-chars')
    html.style.removeProperty('--mc-terminal-font')
  }
}, [settings])
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/App.tsx` | Add terminal class logic in useEffect |

## Implementation Steps

1. Open `src/renderer/App.tsx`

2. Import TERMINAL_FONTS:
   ```typescript
   import { TERMINAL_FONTS } from '@shared/constants'
   ```

3. Find existing theme application useEffect (around line 216-237)

4. Add terminal style logic after existing theme logic:
   ```typescript
   useEffect(() => {
     const { savedSettings } = useSettingsStore.getState()
     // Use pendingSettings for live preview, savedSettings for saved state
     const settings = savedSettings

     const html = document.documentElement

     // ===== EXISTING THEME LOGIC =====
     // Remove old theme classes
     html.classList.remove('light', 'dark')
     COLOR_THEMES.forEach(t => html.classList.remove(`theme-${t.id}`))

     // Apply theme mode
     if (settings.themeMode === 'system') {
       // ...
     }

     // Apply color theme
     html.classList.add(`theme-${settings.colorTheme}`)

     // ===== NEW: TERMINAL STYLE LOGIC =====
     // Remove all terminal classes first
     html.classList.remove('ui-terminal', 'terminal-preset-green', 'terminal-preset-blue', 'terminal-preset-white', 'use-border-chars')

     if (settings.uiStyle === 'terminal') {
       html.classList.add('ui-terminal')
       html.classList.add(`terminal-preset-${settings.terminalStyleOptions.colorPreset}`)

       if (settings.terminalStyleOptions.useBorderChars) {
         html.classList.add('use-border-chars')
       }

       // Set font variable
       const font = TERMINAL_FONTS.find(f => f.id === settings.terminalStyleOptions.fontFamily)
       html.style.setProperty('--mc-terminal-font', font?.family || "'JetBrains Mono', monospace")
     } else {
       html.style.removeProperty('--mc-terminal-font')
     }
   }, [savedSettings])
   ```

5. For LIVE PREVIEW in settings modal, add another effect watching pendingSettings:
   ```typescript
   // Live preview effect
   const { pendingSettings } = useSettingsStore()

   useEffect(() => {
     const html = document.documentElement

     // Apply preview styles while settings modal is open
     // Terminal style preview
     html.classList.remove('ui-terminal', 'terminal-preset-green', 'terminal-preset-blue', 'terminal-preset-white', 'use-border-chars')

     if (pendingSettings.uiStyle === 'terminal') {
       html.classList.add('ui-terminal')
       html.classList.add(`terminal-preset-${pendingSettings.terminalStyleOptions.colorPreset}`)

       if (pendingSettings.terminalStyleOptions.useBorderChars) {
         html.classList.add('use-border-chars')
       }

       const font = TERMINAL_FONTS.find(f => f.id === pendingSettings.terminalStyleOptions.fontFamily)
       html.style.setProperty('--mc-terminal-font', font?.family || "'JetBrains Mono', monospace")
     } else {
       html.style.removeProperty('--mc-terminal-font')
     }
   }, [pendingSettings])
   ```

6. Ensure classes are cleaned up on Cancel:
   - Existing Cancel handler in settings-store should reset pendingSettings to savedSettings
   - The effect will automatically revert classes

## Todo List
- [x] Import TERMINAL_FONTS in App.tsx
- [x] Add terminal class removal in useEffect
- [x] Add ui-terminal class when terminal mode
- [x] Add terminal-preset-{color} class
- [x] Add use-border-chars class conditionally
- [x] Set --mc-terminal-font CSS variable
- [x] Test live preview in settings
- [x] Test Cancel reverts correctly
- [x] Test Save persists correctly

## Success Criteria
- Terminal mode applied on app start if saved
- Live preview works in settings
- Cancel reverts to saved state
- All terminal classes applied correctly
- Font variable set correctly
- No FOUC (flash of unstyled content)

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Multiple useEffects conflict | Single source of truth from store |
| Class removal race condition | Remove all classes before adding |

## Next Steps
- Phase 06: Testing
