# Design Guidelines

## VibeTerminal Theme System (v3.1.0)

MultiClaude v3.1.0-beta.1 uses the VibeTerminal aesthetic: a minimal, terminal-first UI with CSS custom properties and dual theme systems optimized for parallel Claude workflows.

### Theme Systems (Unified in v3.4.4)

**VibeTerminal Unified Themes**: 5 curated themes, each includes UI colors + ANSI 16-color palette
- **Tokyo Night**: Soft pastels, blue accent (#7aa2f7)
- **Catppuccin Mocha**: Warm palette, blue accent (#89b4fa)
- **Dracula**: Vivid purples, accent (#bd93f9)
- **Rosé Pine**: Muted tones, mauve accent (#c4a7e7)
- **Pro Dark**: GitHub-inspired, blue accent (#3b82f6)

**Dark/Light/System modes** applied globally; all themes ship dark (user preference controls OS adaptation)
- Controls UI chrome (toolbar, panels, buttons, text) + terminal ANSI colors in xterm.js

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

**Terminal Pane Tree**:
- Binary split tree layout (tmux/iTerm-style) managed via `PaneTreeStore`
- Recursive pane tree nodes: each node is a terminal or a split container
- Per-pane bottom tab bar with title, Claude badge, close icon
- Right-click context menu (themed Portal) for split/close actions
- Split buttons on each pane provide keyboard-free split access
- Per-project pane tree persistence via `terminal:load-pane-tree` / `terminal:save-pane-tree` IPC channels

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+1-9 | Switch to project |
| Ctrl+N/T | New terminal |
| Ctrl+W | Close active terminal |
| Ctrl+G | Toggle GitHub panel |

**Note**: Escape key handling is managed by `shortcut-utils.ts` to prevent leakage during project switching.

### Terminal Renderer Policy UI

Settings > Diagnostics owns one keyboard-operable radio group:

- **Automatic (Recommended)**: WebGL for regular shells; safer non-WebGL rendering for Claude and Codex.
- **Prefer GPU**: attempts WebGL for all terminals and falls back automatically.
- **Compatibility**: Disables WebGL for maximum compatibility.

Preference and effective state remain separate. Each live terminal row uses its
ID as the label, displays `WebGL` or `DOM` with fixed fallback copy, and shows
Retry GPU only for recoverable terminal-local faults. Do not display title,
cwd, command, transcript, raw error, or GPU/device data.

### Element Styling Guidelines

**Circular Elements**: Use `.rounded-full` for avatars, status badges, toggle switches
**Spacing**: Toolbar icons 15x15px, button gaps 2px, panel width 340px (landscape)
**Typography**: UI = system font (macOS/Segoe UI), Terminal = JetBrains Mono with Nerd Font symbols for Claude renderer
