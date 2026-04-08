# Design Guidelines

## VibeTerminal Theme System (v3.1.0)

MultiClaude v3.1.0-beta.1 uses the VibeTerminal aesthetic: a minimal, terminal-first UI with CSS custom properties and dual theme systems optimized for parallel Claude workflows.

### Theme Systems (Two Independent Concepts)

**1. UI Color Themes** (app chrome: toolbar, panels, buttons, text)
- **7 themes**: Default, Dusk, Lime, Ocean, Retro, Neo, Forest
- **Dark/Light/System modes** applied to each theme
- Controls toolbar, panels, settings UI, button states
- Tailwind-based with CSS variable overrides for custom colors

**2. Terminal ANSI Palette Themes** (xterm.js rendering)
- **5 curated palettes**: Tokyo Night, Catppuccin Mocha, Dracula, Rosé Pine, Pro Dark
- Applied to terminal text, cursor colors, selection background
- Independent from UI theme; users can mix (e.g., Forest UI + Tokyo Night terminal)

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

### Terminal Rendering Modes UI

Three preset modes (Settings > Terminals > Rendering Mode):
- **⚡ Performance**: No WebGL, best for 9+ terminals, lower GPU load
- **⚖️ Balanced** (default): WebGL on active terminal only, balanced experience
- **✨ Quality**: WebGL always on, best visual clarity

**Claude-safe Mode** (Experimental):
- Badge shows current GPU state: "GPU unavailable" (Performance) | "Claude-safe mode" (safe) | "Claude follows mode" (experimental)
- When disabled: Claude terminals always use canvas renderer (safer)
- When enabled: Claude terminals use selected rendering mode (experimental, may have rendering issues)
- Toggle disabled in Performance mode (GPU off globally)

### Element Styling Guidelines

**Circular Elements**: Use `.rounded-full` for avatars, status badges, toggle switches
**Spacing**: Toolbar icons 15x15px, button gaps 2px, panel width 340px (landscape)
**Typography**: UI = system font (macOS/Segoe UI), Terminal = JetBrains Mono with Nerd Font symbols for Claude renderer
