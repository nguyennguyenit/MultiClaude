# Phase 01: Types & Constants

## Context
- Parent: [plan.md](./plan.md)
- Brainstorm: [brainstorm report](../reports/brainstorm-260115-2211-terminal-ui-style-system.md)

## Overview
- **Priority**: High
- **Status**: DONE (2026-01-18)
- **Effort**: 1h
- **Description**: Define TypeScript types and constants for Terminal UI Style system

## Key Insights
- Extend existing AppSettings interface
- Add new types: UiStyle, TerminalColorPreset, TerminalStyleOptions
- Add constants: TERMINAL_COLOR_PRESETS, TERMINAL_FONTS
- Follow existing patterns in themes.ts

## Requirements

### Functional
- UiStyle type: 'modern' | 'terminal'
- TerminalColorPreset: 'green' | 'blue' | 'white'
- TerminalStyleOptions interface with colorPreset, fontFamily, useBorderChars
- Color preset definitions with hex values
- Font list with display names

### Non-Functional
- Type safety across main/renderer processes
- Default values for all new settings

## Architecture

```typescript
// New types
type UiStyle = 'modern' | 'terminal'
type TerminalColorPreset = 'green' | 'blue' | 'white'

interface TerminalStyleOptions {
  colorPreset: TerminalColorPreset
  fontFamily: string
  useBorderChars: boolean
}

// Extended AppSettings
interface AppSettings {
  // ... existing
  uiStyle: UiStyle
  terminalStyleOptions: TerminalStyleOptions
}
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | Add UiStyle, TerminalColorPreset, TerminalStyleOptions types |
| `src/shared/constants/themes.ts` | Add TERMINAL_COLOR_PRESETS, TERMINAL_FONTS, update DEFAULT_SETTINGS |

## Implementation Steps

1. Open `src/shared/types/index.ts`
2. Add new types after existing theme types:
   ```typescript
   export type UiStyle = 'modern' | 'terminal'
   export type TerminalColorPreset = 'green' | 'blue' | 'white'

   export interface TerminalStyleOptions {
     colorPreset: TerminalColorPreset
     fontFamily: string
     useBorderChars: boolean
   }
   ```
3. Update AppSettings interface to include:
   ```typescript
   uiStyle: UiStyle
   terminalStyleOptions: TerminalStyleOptions
   ```
4. Open `src/shared/constants/themes.ts`
5. Add color preset definitions:
   ```typescript
   export const TERMINAL_COLOR_PRESETS = {
     green: {
       id: 'green',
       name: 'Matrix',
       bg: '#001C00',
       text: '#00FF00',
       textSecondary: '#00A300',
       accent: '#00FF00',
       border: '#00FF00'
     },
     blue: {
       id: 'blue',
       name: 'Cyan',
       bg: '#001020',
       text: '#00BFFF',
       textSecondary: '#0088AA',
       accent: '#00FFFF',
       border: '#00BFFF'
     },
     white: {
       id: 'white',
       name: 'Mono',
       bg: '#000000',
       text: '#FFFFFF',
       textSecondary: '#AAAAAA',
       accent: '#FFFFFF',
       border: '#FFFFFF'
     }
   } as const
   ```
6. Add font definitions:
   ```typescript
   export const TERMINAL_FONTS = [
     { id: 'jetbrains-mono', name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
     { id: 'source-code-pro', name: 'Source Code Pro', family: "'Source Code Pro', monospace" },
     { id: 'fira-code', name: 'Fira Code', family: "'Fira Code', monospace" },
     { id: 'vt323', name: 'VT323 (Retro)', family: "'VT323', monospace" },
     { id: 'ibm-plex-mono', name: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace" },
     { id: 'space-mono', name: 'Space Mono', family: "'Space Mono', monospace" }
   ] as const
   ```
7. Update DEFAULT_SETTINGS:
   ```typescript
   export const DEFAULT_SETTINGS: AppSettings = {
     // ... existing
     uiStyle: 'modern',
     terminalStyleOptions: {
       colorPreset: 'green',
       fontFamily: 'jetbrains-mono',
       useBorderChars: false
     }
   }
   ```

## Todo List
- [x] Add UiStyle type
- [x] Add TerminalColorPreset type
- [x] Add TerminalStyleOptions interface
- [x] Update AppSettings interface
- [x] Add TERMINAL_COLOR_PRESETS constant
- [x] Add TERMINAL_FONTS constant
- [x] Update DEFAULT_SETTINGS
- [x] Run typecheck: `npm run typecheck`

## Success Criteria
- No TypeScript errors
- Types exported and accessible from @shared/types
- Constants exported from @shared/constants
- DEFAULT_SETTINGS includes new fields

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Breaking existing settings | Add new fields with defaults, no removal |
| Type conflicts | Use distinct type names |

## Next Steps
- Phase 02: CSS Variables & Styles
