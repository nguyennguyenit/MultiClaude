# Phase 2: Appearance Tab

## Context

- Plan: `plans/260104-0431-ui-redesign-phase4-settings-modal/plan.md`
- Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 377-433)
- Depends: Phase 1

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 1h

Refactor ThemeSelector for modal layout with card-style mode selector and theme grid.

## Requirements

### Design
```
│   Appearance                                        │
│   Customize how MultiClaude looks                  │
│   ─────────────────────────────────────────────    │
│                                                     │
│   Appearance Mode                                   │
│   Choose light, dark, or system preference         │
│                                                     │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│   │   🖥️    │ │   ☀️    │ │   🌙  ✓ │           │
│   │  System  │ │  Light   │ │   Dark   │           │
│   └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
│   Color Theme                                       │
│   Select a color palette for the interface         │
│                                                     │
│   ┌────────┐ ┌────────┐ ┌────────┐                 │
│   │●● Def  │ │●● Dusk │ │●● Lime │                 │
│   └────────┘ └────────┘ └────────┘                 │
│   (7 themes in 3x3 grid)                           │
```

### Options
| Option | Type | Values | Default |
|--------|------|--------|---------|
| Appearance Mode | Card Select | System, Light, Dark | Dark |
| Color Theme | Card Grid | Default, Dusk, Lime, Ocean, Retro, Neo, Forest | Retro |

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/components/settings/theme-selector.tsx` | New layout |

## Implementation Steps

### Step 1: Refactor ThemeSelector

```tsx
// src/renderer/components/settings/theme-selector.tsx
export function ThemeSelector() {
  const { settings, setThemeMode, setColorTheme } = useSettingsStore()

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-medium">Appearance</h3>
        <p className="text-sm text-[var(--mc-text-muted)]">
          Customize how MultiClaude looks
        </p>
        <hr className="my-4 border-[var(--mc-border)]" />
      </div>

      {/* Appearance Mode */}
      <div>
        <h4 className="text-sm font-medium mb-1">Appearance Mode</h4>
        <p className="text-xs text-[var(--mc-text-muted)] mb-3">
          Choose light, dark, or system preference
        </p>
        <div className="flex gap-3">
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <ModeCard
              key={mode}
              mode={mode}
              selected={settings.themeMode === mode}
              onClick={() => setThemeMode(mode)}
            />
          ))}
        </div>
      </div>

      {/* Color Theme */}
      <div>
        <h4 className="text-sm font-medium mb-1">Color Theme</h4>
        <p className="text-xs text-[var(--mc-text-muted)] mb-3">
          Select a color palette for the interface
        </p>
        <div className="grid grid-cols-3 gap-3">
          {COLOR_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={settings.colorTheme === theme.id}
              onClick={() => setColorTheme(theme.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ModeCard({ mode, selected, onClick }: {
  mode: ThemeMode
  selected: boolean
  onClick: () => void
}) {
  const icons = { system: '🖥️', light: '☀️', dark: '🌙' }
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center p-4 rounded-lg border-2 min-w-[80px]
        ${selected
          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}`}
    >
      <span className="text-2xl mb-1">{icons[mode]}</span>
      <span className="text-sm capitalize">{mode}</span>
      {selected && <span className="text-[var(--mc-accent)]">✓</span>}
    </button>
  )
}

function ThemeCard({ theme, selected, onClick }: {
  theme: ColorThemeConfig
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border-2 text-left
        ${selected
          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}`}
    >
      <div className="flex gap-1 mb-2">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.previewColors.darkBg }} />
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.previewColors.accent }} />
      </div>
      <span className="text-sm font-medium">{theme.name}</span>
      {selected && <span className="ml-1 text-[var(--mc-accent)]">✓</span>}
    </button>
  )
}
```

## Todo List

- [ ] Refactor ThemeSelector layout
- [ ] Create ModeCard component
- [ ] Create ThemeCard component
- [ ] Add section headers with descriptions
- [ ] Style per design spec
- [ ] Test mode switching
- [ ] Test theme switching

## Success Criteria

- [ ] Card-style mode selector (3 cards)
- [ ] Grid theme selector (7 themes)
- [ ] Selected state shows checkmark
- [ ] Hover states work
- [ ] Settings persist on change

## Next Steps

Proceed to Phase 3: Terminals Tab
