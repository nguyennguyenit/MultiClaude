# Brainstorm: Terminal UI Style System

**Date**: 2026-01-15
**Status**: Agreed
**Complexity**: High (~8-12 hours)

## Problem Statement

User muốn thêm tùy chọn "Terminal/TUI Style" trong Settings → Appearance để redesign toàn bộ app theo phong cách retro terminal như Mastui client.

## Requirements

| Requirement | Detail |
|-------------|--------|
| UI Style | Modern (default) vs Terminal |
| Color Presets | Green (Matrix), Blue (Cyan), White |
| Font Selection | Dropdown: JetBrains Mono, Source Code Pro, Fira Code, VT323, etc. |
| Border Styles | Toggle: 1px solid vs ASCII box-drawing chars |
| Scope | Tất cả components: main UI, modals, dialogs, tooltips |

## Solution Architecture

### New Settings Schema

```typescript
// src/shared/types/settings.ts
interface AppSettings {
  // ... existing
  uiStyle: 'modern' | 'terminal'
  terminalStyleOptions?: {
    colorPreset: 'green' | 'blue' | 'white'
    fontFamily: string
    useBorderChars: boolean  // ASCII box-drawing vs 1px solid
  }
}
```

### CSS Architecture

```
globals.css
├── .ui-modern (default - no changes)
└── .ui-terminal
    ├── Font: monospace family
    ├── Colors: --mc-terminal-* variables
    ├── Borders: 1px solid or box-chars
    └── Scrollbar: terminal style
```

### Color Presets

| Preset | Background | Primary Text | Secondary | Accent |
|--------|------------|--------------|-----------|--------|
| Green (Matrix) | #001C00 | #00FF00 | #00A300 | #00FF00 |
| Blue (Cyan) | #001020 | #00BFFF | #0088AA | #00FFFF |
| White | #000000 | #FFFFFF | #AAAAAA | #FFFFFF |

### Font Options

- JetBrains Mono (Recommended)
- Source Code Pro
- Fira Code
- VT323 (Retro pixel)
- IBM Plex Mono
- Space Mono

### Files to Modify

| File | Changes |
|------|---------|
| `shared/types/settings.ts` | Add uiStyle + terminalStyleOptions |
| `shared/constants/themes.ts` | Add TERMINAL_PRESETS, TERMINAL_FONTS |
| `renderer/styles/globals.css` | Add .ui-terminal classes (~100 lines) |
| `renderer/stores/settings-store.ts` | Add setUiStyle, setTerminalOptions actions |
| `renderer/components/settings/theme-selector.tsx` | Add UI Style section |
| `renderer/App.tsx` | Apply ui-terminal class to html |
| `main/settings/settings-store.ts` | Update schema validation |

### New Component: TerminalStyleOptions

```tsx
// When uiStyle === 'terminal', show:
<TerminalStyleOptions>
  <ColorPresetPicker />  // Green, Blue, White cards
  <FontFamilyDropdown /> // JetBrains Mono, etc.
  <BorderStyleToggle />  // 1px solid vs ASCII
</TerminalStyleOptions>
```

## Implementation Considerations

### Pros
- Full customization for terminal enthusiasts
- Clean separation: uiStyle independent of colorTheme
- Extensible: có thể thêm presets/fonts sau

### Cons
- Significant CSS work (~100+ lines)
- Need to test all components in terminal mode
- Font loading: Google Fonts hoặc bundle local?

### Risks

| Risk | Mitigation |
|------|------------|
| Performance với custom fonts | Lazy load fonts khi cần |
| Readability với box-drawing chars | Default to 1px solid, box-chars optional |
| Breaking existing styles | Use separate CSS layer, không sửa existing |

## Success Criteria

1. User có thể toggle giữa Modern và Terminal UI style
2. Terminal mode có 3 color presets hoạt động đúng
3. Font dropdown thay đổi font toàn app khi ở Terminal mode
4. Border toggle hoạt động (1px solid vs ASCII)
5. All components (modal, dialog, tooltip) đều styled đúng
6. Settings persist sau restart
7. Không ảnh hưởng Modern mode hiện tại

## Next Steps

1. Update TypeScript types
2. Add CSS variables và .ui-terminal classes
3. Create TerminalStyleOptions component
4. Update theme-selector.tsx với UI Style section
5. Apply classes trong App.tsx
6. Test tất cả components
7. Update E2E tests

## Questions Resolved

- ✅ Scope: Toàn bộ app
- ✅ Font: Dropdown selection
- ✅ Borders: Toggle between styles
- ✅ Presets: Green, Blue, White
