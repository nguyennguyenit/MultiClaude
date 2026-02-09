# Phase 02: CSS Variables & Styles

## Context
- Parent: [plan.md](./plan.md)
- Research: [Google Fonts](./research/researcher-01-google-fonts-electron.md), [ASCII Borders](./research/researcher-02-ascii-borders-css.md)
- Depends on: Phase 01

## Overview
- **Priority**: High
- **Status**: Complete ✅
- **Effort**: 3h
- **Description**: Add CSS variables, font imports, and .ui-terminal styles

## Key Insights
- Use @fontsource packages for self-hosted fonts (offline support)
- CSS custom properties for terminal color presets
- Separate layer for terminal styles (no breaking existing)
- ASCII borders via pseudo-elements with monospace font

## Requirements

### Functional
- Import monospace fonts via @fontsource
- CSS variables for terminal presets: --mc-terminal-*
- .ui-terminal class with all style overrides
- Border character rendering for ASCII mode
- Terminal-style scrollbars

### Non-Functional
- font-display: swap for performance
- No impact on Modern mode
- Works in dark mode only (terminal aesthetic)

## Architecture

```css
/* Layer structure */
.ui-terminal {
  /* Font override */
  font-family: var(--mc-terminal-font);

  /* Colors override CSS variables */
  --mc-bg-primary: var(--mc-terminal-bg);
  --mc-text-primary: var(--mc-terminal-text);
  /* ... more overrides */

  /* Global styles */
  border-radius: 0;

  /* Scrollbar */
  scrollbar styling...
}

/* ASCII border utility */
.ui-terminal .terminal-border { ... }
```

## Related Code Files

### Install Dependencies
```bash
npm install @fontsource/jetbrains-mono @fontsource/source-code-pro @fontsource/fira-code
```

### Modify
| File | Changes |
|------|---------|
| `src/renderer/main.tsx` | Import @fontsource packages |
| `src/renderer/styles/globals.css` | Add terminal CSS variables and .ui-terminal classes |

## Implementation Steps

1. Install font packages:
   ```bash
   npm install @fontsource/jetbrains-mono @fontsource/source-code-pro @fontsource/fira-code @fontsource/ibm-plex-mono @fontsource/space-mono
   ```

2. Update `src/renderer/main.tsx` to import fonts:
   ```typescript
   // Terminal style fonts
   import '@fontsource/jetbrains-mono/400.css'
   import '@fontsource/jetbrains-mono/500.css'
   import '@fontsource/source-code-pro/400.css'
   import '@fontsource/fira-code/400.css'
   import '@fontsource/ibm-plex-mono/400.css'
   import '@fontsource/space-mono/400.css'
   ```

3. Add to `src/renderer/styles/globals.css` after existing themes:
   ```css
   /* ============================================
      Terminal UI Style System
      ============================================ */

   /* Terminal font custom property */
   :root {
     --mc-terminal-font: 'JetBrains Mono', monospace;
   }

   /* Terminal Color Presets */
   .terminal-preset-green {
     --mc-terminal-bg: #001C00;
     --mc-terminal-bg-secondary: #002200;
     --mc-terminal-text: #00FF00;
     --mc-terminal-text-secondary: #00A300;
     --mc-terminal-text-muted: #006600;
     --mc-terminal-accent: #00FF00;
     --mc-terminal-border: #00FF00;
   }

   .terminal-preset-blue {
     --mc-terminal-bg: #001020;
     --mc-terminal-bg-secondary: #001830;
     --mc-terminal-text: #00BFFF;
     --mc-terminal-text-secondary: #0088AA;
     --mc-terminal-text-muted: #005577;
     --mc-terminal-accent: #00FFFF;
     --mc-terminal-border: #00BFFF;
   }

   .terminal-preset-white {
     --mc-terminal-bg: #000000;
     --mc-terminal-bg-secondary: #111111;
     --mc-terminal-text: #FFFFFF;
     --mc-terminal-text-secondary: #AAAAAA;
     --mc-terminal-text-muted: #666666;
     --mc-terminal-accent: #FFFFFF;
     --mc-terminal-border: #FFFFFF;
   }

   /* Terminal UI Style - Override CSS Variables */
   .ui-terminal {
     /* Override core variables with terminal values */
     --mc-bg-primary: var(--mc-terminal-bg);
     --mc-bg-secondary: var(--mc-terminal-bg-secondary);
     --mc-bg-tertiary: var(--mc-terminal-bg-secondary);
     --mc-bg-hover: color-mix(in srgb, var(--mc-terminal-text) 10%, var(--mc-terminal-bg));
     --mc-bg-active: color-mix(in srgb, var(--mc-terminal-text) 15%, var(--mc-terminal-bg));
     --mc-text-primary: var(--mc-terminal-text);
     --mc-text-secondary: var(--mc-terminal-text-secondary);
     --mc-text-muted: var(--mc-terminal-text-muted);
     --mc-border: var(--mc-terminal-border);
     --mc-accent: var(--mc-terminal-accent);
     --mc-accent-hover: var(--mc-terminal-accent);

     /* Font */
     font-family: var(--mc-terminal-font);

     /* Remove all border-radius */
     * {
       border-radius: 0 !important;
     }
   }

   /* Terminal scrollbar */
   .ui-terminal ::-webkit-scrollbar {
     width: 8px;
     height: 8px;
   }

   .ui-terminal ::-webkit-scrollbar-track {
     background: var(--mc-terminal-bg);
   }

   .ui-terminal ::-webkit-scrollbar-thumb {
     background: var(--mc-terminal-border);
     border: 1px solid var(--mc-terminal-bg);
   }

   /* ASCII Border Mode */
   .ui-terminal.use-border-chars {
     /* Borders become 1px for base, chars added via pseudo */
   }

   .ui-terminal.use-border-chars .ascii-border {
     position: relative;
     border: none !important;
   }

   .ui-terminal.use-border-chars .ascii-border::before {
     content: '┌' attr(data-top) '┐';
     position: absolute;
     top: -1em;
     left: 0;
     font-family: var(--mc-terminal-font);
     color: var(--mc-terminal-border);
     line-height: 1;
   }

   /* Button styles in terminal mode */
   .ui-terminal button {
     border: 1px solid var(--mc-terminal-border);
     background: transparent;
     color: var(--mc-terminal-text);
   }

   .ui-terminal button:hover {
     background: var(--mc-bg-hover);
   }

   /* Input styles in terminal mode */
   .ui-terminal input,
   .ui-terminal select,
   .ui-terminal textarea {
     border: 1px solid var(--mc-terminal-border);
     background: var(--mc-terminal-bg);
     color: var(--mc-terminal-text);
     font-family: var(--mc-terminal-font);
   }

   .ui-terminal input:focus,
   .ui-terminal select:focus,
   .ui-terminal textarea:focus {
     outline: 1px solid var(--mc-terminal-accent);
     outline-offset: -1px;
   }

   /* Modal in terminal mode */
   .ui-terminal .modal-backdrop {
     background: rgba(0, 0, 0, 0.9);
   }
   ```

## Todo List
- [x] Install @fontsource packages
- [x] Import fonts in main.tsx
- [x] Add --mc-terminal-font variable
- [x] Add terminal-preset-* classes (green, blue, white)
- [x] Add .ui-terminal base styles
- [x] Add terminal scrollbar styles
- [x] Add terminal button/input styles
- [x] Add ASCII border utilities

## Code Review Results
- **Review Date**: 2026-01-18 00:37
- **Score**: 8.5/10
- **Status**: ✅ APPROVED with recommendations
- **Report**: [code-reviewer-260118-0037-terminal-css-phase-02.md](./reports/code-reviewer-260118-0037-terminal-css-phase-02.md)

**Key Findings**:
- ✅ All tests pass (146/146)
- ✅ No security issues
- ✅ Clean CSS organization
- ⚠️ Electron 33 supports color-mix() (Chrome 118+)
- ⚠️ Consider refactoring `!important` usage
- ⚠️ ASCII border needs documentation (deferred to Phase 04)

## Success Criteria
- Fonts load correctly (DevTools Network tab)
- .ui-terminal class overrides all colors
- border-radius: 0 on all elements
- Scrollbars styled in terminal mode
- No visual regression in Modern mode

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Font loading delays | Use font-display: swap via @fontsource |
| CSS specificity conflicts | Use .ui-terminal prefix for all overrides |
| !important overuse | Only for border-radius reset |

## Next Steps
- Phase 03: Settings Store
