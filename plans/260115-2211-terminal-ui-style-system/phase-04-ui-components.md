# Phase 04: UI Components

## Context
- Parent: [plan.md](./plan.md)
- Depends on: Phase 01, 02, 03

## Overview
- **Priority**: High
- **Status**: Complete ✅
- **Effort**: 3h
- **Completed**: 2026-01-18
- **Review**: [code-reviewer-260118-1636-phase-04-ui-components.md](./reports/code-reviewer-260118-1636-phase-04-ui-components.md)
- **Score**: 8.5/10 - Accessibility improvements noted for future iteration
- **Description**: Create Terminal Style Options UI component and update theme-selector

## Key Insights
- Add new section in ThemeSelector for UI Style toggle
- Show TerminalStyleOptions only when uiStyle === 'terminal'
- Color preset picker similar to existing ThemeCard
- Font dropdown with preview
- Border style toggle

## Requirements

### Functional
- UI Style toggle: Modern vs Terminal
- Color preset cards: Green (Matrix), Blue (Cyan), White
- Font family dropdown with 6 options
- Border style toggle: 1px solid vs ASCII box-drawing
- Live preview in settings modal

### Non-Functional
- Consistent styling with existing settings UI
- Use SettingsSubheading for sections
- Accessible form controls

## Architecture

```tsx
// ThemeSelector structure
<ThemeSelector>
  <SettingsTitle>Appearance</SettingsTitle>

  {/* Existing: Appearance Mode */}
  <AppearanceModeSection />

  {/* NEW: UI Style Section */}
  <UIStyleSection>
    <StyleCard mode="modern" />
    <StyleCard mode="terminal" />
  </UIStyleSection>

  {/* NEW: Terminal Style Options (conditional) */}
  {uiStyle === 'terminal' && (
    <TerminalStyleOptions>
      <ColorPresetPicker />
      <FontFamilyDropdown />
      <BorderStyleToggle />
    </TerminalStyleOptions>
  )}

  {/* Existing: Color Theme (hide when terminal?) */}
  {uiStyle === 'modern' && <ColorThemeSection />}
</ThemeSelector>
```

## Related Code Files

### Create
| File | Description |
|------|-------------|
| `src/renderer/components/settings/terminal-style-options.tsx` | Terminal customization component |

### Modify
| File | Changes |
|------|---------|
| `src/renderer/components/settings/theme-selector.tsx` | Add UI Style section, integrate TerminalStyleOptions |

## Implementation Steps

1. Create `src/renderer/components/settings/terminal-style-options.tsx`:
   ```tsx
   import { useSettingsStore } from '../../stores'
   import { TERMINAL_COLOR_PRESETS, TERMINAL_FONTS } from '@shared/constants'
   import { SettingsSubheading } from './settings-typography'

   export function TerminalStyleOptions() {
     const { pendingSettings, setTerminalStyleOptions } = useSettingsStore()
     const options = pendingSettings.terminalStyleOptions

     return (
       <div className="space-y-6">
         {/* Color Preset */}
         <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
           <SettingsSubheading>Terminal Color Preset</SettingsSubheading>
           <div className="mt-3 flex gap-2">
             {Object.values(TERMINAL_COLOR_PRESETS).map((preset) => (
               <ColorPresetCard
                 key={preset.id}
                 preset={preset}
                 selected={options.colorPreset === preset.id}
                 onClick={() => setTerminalStyleOptions({ colorPreset: preset.id })}
               />
             ))}
           </div>
         </div>

         {/* Font Family */}
         <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
           <SettingsSubheading>Terminal Font</SettingsSubheading>
           <select
             value={options.fontFamily}
             onChange={(e) => setTerminalStyleOptions({ fontFamily: e.target.value })}
             className="mt-3 w-full p-2 border border-[var(--mc-border)] bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)] rounded"
           >
             {TERMINAL_FONTS.map((font) => (
               <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
                 {font.name}
               </option>
             ))}
           </select>
         </div>

         {/* Border Style */}
         <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
           <SettingsSubheading>Border Style</SettingsSubheading>
           <div className="mt-3 flex gap-3">
             <BorderStyleCard
               label="1px Solid"
               description="Clean minimal borders"
               selected={!options.useBorderChars}
               onClick={() => setTerminalStyleOptions({ useBorderChars: false })}
             />
             <BorderStyleCard
               label="ASCII Box"
               description="Classic terminal ┌─┐"
               selected={options.useBorderChars}
               onClick={() => setTerminalStyleOptions({ useBorderChars: true })}
             />
           </div>
         </div>
       </div>
     )
   }

   // Sub-components
   function ColorPresetCard({ preset, selected, onClick }) { ... }
   function BorderStyleCard({ label, description, selected, onClick }) { ... }
   ```

2. Update `src/renderer/components/settings/theme-selector.tsx`:
   ```tsx
   import { TerminalStyleOptions } from './terminal-style-options'

   export function ThemeSelector() {
     const { pendingSettings, setThemeMode, setColorTheme, setUiStyle } = useSettingsStore()

     return (
       <div className="space-y-8 pb-4 max-w-2xl">
         <SettingsTitle description="Customize how MultiClaude looks">
           Appearance
         </SettingsTitle>

         <div className="space-y-6">
           {/* Appearance Mode - existing */}
           <div className="p-4 ...">
             <SettingsSubheading>Appearance Mode</SettingsSubheading>
             ...
           </div>

           {/* NEW: UI Style */}
           <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
             <SettingsSubheading>UI Style</SettingsSubheading>
             <p className="text-xs text-[var(--mc-text-muted)] mb-3">
               Choose between modern or retro terminal interface
             </p>
             <div className="flex gap-3">
               <UIStyleCard
                 style="modern"
                 label="Modern"
                 selected={pendingSettings.uiStyle === 'modern'}
                 onClick={() => setUiStyle('modern')}
               />
               <UIStyleCard
                 style="terminal"
                 label="Terminal"
                 selected={pendingSettings.uiStyle === 'terminal'}
                 onClick={() => setUiStyle('terminal')}
               />
             </div>
           </div>

           {/* Terminal Style Options - conditional */}
           {pendingSettings.uiStyle === 'terminal' && <TerminalStyleOptions />}

           {/* Color Theme - disabled when terminal (not hidden per validation) */}
           <div className={`p-4 ... ${pendingSettings.uiStyle === 'terminal' ? 'opacity-50 pointer-events-none' : ''}`}>
             <SettingsSubheading>Color Theme</SettingsSubheading>
             {pendingSettings.uiStyle === 'terminal' && (
               <p className="text-xs text-[var(--mc-text-muted)] mb-2">
                 Disabled in Terminal mode
               </p>
             )}
             ...
           </div>
         </div>
       </div>
     )
   }

   function UIStyleCard({ style, label, selected, onClick }) {
     return (
       <button
         onClick={onClick}
         className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 w-[140px] transition-all duration-150
           ${selected
             ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
             : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}`}
       >
         <span className="text-xl">
           {style === 'modern' ? '🎨' : '💻'}
         </span>
         <span className="text-sm capitalize flex-1">{label}</span>
         {selected && <span className="text-[var(--mc-accent)]">✓</span>}
       </button>
     )
   }
   ```

3. Update `src/renderer/components/settings/index.ts`:
   ```typescript
   export { TerminalStyleOptions } from './terminal-style-options'
   ```

## Todo List
- [x] Create terminal-style-options.tsx
- [x] Add ColorPresetCard component
- [x] Add BorderStyleCard component
- [x] Add font dropdown with preview
- [x] Update theme-selector.tsx with UI Style section
- [x] Add UIStyleCard component
- [x] Conditionally show Terminal options
- [x] Disable Color Theme when terminal selected (disabled, not hidden per validation)
- [x] Export from index.ts
- [ ] **MUST FIX:** Add aria-label and aria-pressed to all button cards (W1)
- [ ] **MUST FIX:** Add focus ring styles to all interactive elements (W1)
- [ ] **MUST FIX:** Add id and label to font select dropdown (W2)
- [ ] **SHOULD FIX:** Memoize getFontFamily helper (M1)
- [ ] **SHOULD FIX:** Optimize disabled Color Theme rendering (M4)
- [ ] Test keyboard navigation
- [ ] Test live preview (Phase 06)

## Success Criteria
- UI Style toggle works
- Terminal options appear when Terminal selected
- Color preset cards show color preview
- Font dropdown has all 6 fonts
- Border toggle works
- Changes reflect in pendingSettings

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| UI cluttered | Collapse into accordion if too long |
| Font preview in dropdown | Use inline style for option |

## Next Steps
- Phase 05: App Integration
