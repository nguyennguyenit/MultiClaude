# Design Guidelines

## VibeTerminal Theme System

MultiClaude v3.0.1-beta.13 uses the VibeTerminal aesthetic: a minimal, terminal-first UI with CSS custom properties and dual theme systems.

### Theme Systems (Two Distinct Concepts)

**1. UI Color Themes** (app chrome: toolbar, panels, buttons, text)
- 7 themes: Default, Dusk, Lime, Ocean, Retro, Neo, Forest
- Light/Dark/System modes applied to each
- Controls toolbar, panels, sidebar, UI elements

**2. Terminal ANSI Palette Themes** (xterm.js colors only)
- 5 curated color schemes: Tokyo Night, Catppuccin Mocha, Dracula, Rosé Pine, Pro Dark
- Applied to terminal output, text rendering, cursor colors

### Color Architecture

**CSS Variables** (defined in `src/renderer/styles/globals.css`):
- Layout: `--toolbar-height` (32px), `--tab-height` (28px), `--panel-width` (340px)
- Typography: `--terminal-font`, `--modern-font`
- Colors: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--border`, `--hover`, `--tab-bg`, `--tab-active-bg`, `--cursor`, `--selection-bg`
- Transitions: `--transition-fast` (0.15s ease)

**Theme Definitions** (in `src/shared/constants/themes.ts`):
- VibeTheme interface includes UI colors + full ANSI 16-color palette for xterm
- Themes applied dynamically in App.tsx via `setTheme(themeId)`
- Both systems coexist: UI theme sets chrome, ANSI palette sets terminal colors

### Layout Architecture

**Toolbar** (32px compact header):
- Left: Add Terminal button + Project dropdown
- Right: GitHub panel (Ctrl+G), Settings, Update indicator
- No activity bar or traditional sidebar header
- macOS-aware: Adds 72px padding for traffic light buttons

**Slide Panels** (modal dialogs replaced):
- Git Panel: Right edge on landscape, bottom on portrait
- GitHub Panel: Right edge on landscape, bottom on portrait
- Settings Panel: Right edge on landscape, bottom on portrait
- Each toggleable via toolbar buttons or keyboard shortcuts
- 340px wide on landscape, full height container on portrait

**Terminal Grid**:
- Auto-flex layout replacing react-resizable-panels
- Equal splits for all panes
- Per-pane bottom tab bar (not top bar)
- Grid adapts: 1x1 → 3x4 based on terminal count

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+1-9 | Switch to project |
| Ctrl+N/T | New terminal |
| Ctrl+W | Close active terminal |
| Ctrl+G | Toggle GitHub panel |

**Note**: Escape key handling is managed by `shortcut-utils.ts` to prevent leakage during project switching.

### Element Styling Guidelines

**Circular Elements** (avatars, status indicators):
- Use `.rounded-full` class to preserve circular shape
- Necessary in terminal-first aesthetic with blocky default styling

**Spacing**:
- Use CSS variables for consistency (`--transition-fast` for animations)
- Toolbar items: 15x15px icons, 2px gaps between button groups
- Panel containers: 340px width (4:3 aspect design)

**Typography**:
- UI text: System font stack (macOS/Segoe UI/Roboto)
- Terminal content: JetBrains Mono monospace
- Font sizing: Default system sizes, no custom scaling needed
