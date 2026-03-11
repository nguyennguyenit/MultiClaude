import type { ITheme } from '@xterm/xterm'
import type { ColorTheme } from '../types'

// Base ANSI colors shared across themes
const ANSI_COLORS = {
  dark: {
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff'
  },
  light: {
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5'
  }
}

// Terminal themes matching each ColorTheme × ThemeMode
export const TERMINAL_THEMES: Record<`${ColorTheme}-${'dark' | 'light'}`, ITheme> = {
  // Default theme
  'default-dark': {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#E6E7A3',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    ...ANSI_COLORS.dark
  },
  'default-light': {
    background: '#ffffff',
    foreground: '#1e1e1e',
    cursor: '#8B8C3D',
    cursorAccent: '#ffffff',
    selectionBackground: '#add6ff',
    selectionForeground: '#000000',
    ...ANSI_COLORS.light
  },

  // Dusk theme
  'dusk-dark': {
    background: '#131419',
    foreground: '#d4d4d4',
    cursor: '#E6E7A3',
    cursorAccent: '#131419',
    selectionBackground: '#3a3d4d',
    selectionForeground: '#ffffff',
    ...ANSI_COLORS.dark
  },
  'dusk-light': {
    background: '#fafaf8',
    foreground: '#1e1e1e',
    cursor: '#8B8C3D',
    cursorAccent: '#fafaf8',
    selectionBackground: '#d4d4c8',
    selectionForeground: '#000000',
    ...ANSI_COLORS.light
  },

  // Lime theme
  'lime-dark': {
    background: '#0F0F1A',
    foreground: '#d4d4d4',
    cursor: '#7C3AED',
    cursorAccent: '#0F0F1A',
    selectionBackground: '#3b2d5c',
    selectionForeground: '#ffffff',
    ...ANSI_COLORS.dark
  },
  'lime-light': {
    background: '#fdfff0',
    foreground: '#1e1e1e',
    cursor: '#7C3AED',
    cursorAccent: '#fdfff0',
    selectionBackground: '#d4e8a3',
    selectionForeground: '#000000',
    ...ANSI_COLORS.light
  },

  // Ocean theme
  'ocean-dark': {
    background: '#082F49',
    foreground: '#e0f2fe',
    cursor: '#38BDF8',
    cursorAccent: '#082F49',
    selectionBackground: '#0c4a6e',
    selectionForeground: '#ffffff',
    ...ANSI_COLORS.dark
  },
  'ocean-light': {
    background: '#f0f9ff',
    foreground: '#0c4a6e',
    cursor: '#0284C7',
    cursorAccent: '#f0f9ff',
    selectionBackground: '#bae6fd',
    selectionForeground: '#000000',
    ...ANSI_COLORS.light
  },

  // Retro theme
  'retro-dark': {
    background: '#1C1917',
    foreground: '#e7e5e4',
    cursor: '#D97706',
    cursorAccent: '#1C1917',
    selectionBackground: '#44403c',
    selectionForeground: '#ffffff',
    ...ANSI_COLORS.dark
  },
  'retro-light': {
    background: '#fffbeb',
    foreground: '#1c1917',
    cursor: '#D97706',
    cursorAccent: '#fffbeb',
    selectionBackground: '#fde68a',
    selectionForeground: '#000000',
    ...ANSI_COLORS.light
  },

  // Neo theme
  'neo-dark': {
    background: '#0F0720',
    foreground: '#e9d5ff',
    cursor: '#D946EF',
    cursorAccent: '#0F0720',
    selectionBackground: '#3b0764',
    selectionForeground: '#ffffff',
    ...ANSI_COLORS.dark
  },
  'neo-light': {
    background: '#fefbff',
    foreground: '#1e1e1e',
    cursor: '#D946EF',
    cursorAccent: '#fefbff',
    selectionBackground: '#f5d0fe',
    selectionForeground: '#000000',
    ...ANSI_COLORS.light
  },

  // Forest theme
  'forest-dark': {
    background: '#052E16',
    foreground: '#dcfce7',
    cursor: '#22C55E',
    cursorAccent: '#052E16',
    selectionBackground: '#14532d',
    selectionForeground: '#ffffff',
    ...ANSI_COLORS.dark
  },
  'forest-light': {
    background: '#f0fdf4',
    foreground: '#14532d',
    cursor: '#16A34A',
    cursorAccent: '#f0fdf4',
    selectionBackground: '#bbf7d0',
    selectionForeground: '#000000',
    ...ANSI_COLORS.light
  },

  // Neon Cyber theme - DeFi/crypto cyberpunk with neon cyan
  'neon-cyber-dark': {
    background: '#0A0E17',
    foreground: '#E0F7FF',
    cursor: '#00E5FF',
    cursorAccent: '#0A0E17',
    selectionBackground: '#1E3A5F',
    selectionForeground: '#E0F7FF',
    black: '#0A0E17',
    red: '#FF3366',
    green: '#00FF9F',
    yellow: '#FFE600',
    blue: '#00E5FF',
    magenta: '#B026FF',
    cyan: '#00E5FF',
    white: '#E0F7FF',
    brightBlack: '#4A7A8C',
    brightRed: '#FF6B8A',
    brightGreen: '#33FFAF',
    brightYellow: '#FFED33',
    brightBlue: '#33ECFF',
    brightMagenta: '#C951FF',
    brightCyan: '#66F0FF',
    brightWhite: '#FFFFFF'
  },
  'neon-cyber-light': {
    background: '#EDF8FF',
    foreground: '#0A1628',
    cursor: '#0095A3',
    cursorAccent: '#EDF8FF',
    selectionBackground: '#7DD3FC',
    selectionForeground: '#0A1628',
    ...ANSI_COLORS.light
  },

  // Pro Dark theme - Professional trading platform aesthetic
  'pro-dark-dark': {
    background: '#0D1117',
    foreground: '#E6EDF3',
    cursor: '#3B82F6',
    cursorAccent: '#0D1117',
    selectionBackground: '#30363D',
    selectionForeground: '#E6EDF3',
    black: '#0D1117',
    red: '#F85149',
    green: '#3FB950',
    yellow: '#D29922',
    blue: '#58A6FF',
    magenta: '#BC8CFF',
    cyan: '#39C5CF',
    white: '#E6EDF3',
    brightBlack: '#6E7681',
    brightRed: '#FF7B72',
    brightGreen: '#56D364',
    brightYellow: '#E3B341',
    brightBlue: '#79C0FF',
    brightMagenta: '#D2A8FF',
    brightCyan: '#56D4DD',
    brightWhite: '#FFFFFF'
  },
  'pro-dark-light': {
    background: '#F6F8FA',
    foreground: '#1F2328',
    cursor: '#2563EB',
    cursorAccent: '#F6F8FA',
    selectionBackground: '#D1D5DB',
    selectionForeground: '#1F2328',
    ...ANSI_COLORS.light
  },

  // ---- New VibeTerminal themes (dark-only) ----

  'tokyo-night-dark': {
    background: '#1a1b26', foreground: '#c0caf5', cursor: '#c0caf5',
    cursorAccent: '#1a1b26', selectionBackground: '#283457',
    black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
    blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
    brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68',
    brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5'
  },
  'tokyo-night-light': {
    background: '#1a1b26', foreground: '#c0caf5', cursor: '#c0caf5',
    cursorAccent: '#1a1b26', selectionBackground: '#283457',
    black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
    blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
    brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68',
    brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5'
  },

  'catppuccin-dark': {
    background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc',
    cursorAccent: '#1e1e2e', selectionBackground: '#45475a',
    black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
    blue: '#89b4fa', magenta: '#cba6f7', cyan: '#94e2d5', white: '#bac2de',
    brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
    brightBlue: '#89b4fa', brightMagenta: '#cba6f7', brightCyan: '#94e2d5', brightWhite: '#a6adc8'
  },
  'catppuccin-light': {
    background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc',
    cursorAccent: '#1e1e2e', selectionBackground: '#45475a',
    black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
    blue: '#89b4fa', magenta: '#cba6f7', cyan: '#94e2d5', white: '#bac2de',
    brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
    brightBlue: '#89b4fa', brightMagenta: '#cba6f7', brightCyan: '#94e2d5', brightWhite: '#a6adc8'
  },

  'dracula-dark': {
    background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f2',
    cursorAccent: '#282a36', selectionBackground: '#44475a',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
    brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
  },
  'dracula-light': {
    background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f2',
    cursorAccent: '#282a36', selectionBackground: '#44475a',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
    brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
  },

  'rose-pine-dark': {
    background: '#191724', foreground: '#e0def4', cursor: '#e0def4',
    cursorAccent: '#191724', selectionBackground: '#2a283e',
    black: '#26233a', red: '#eb6f92', green: '#31748f', yellow: '#f6c177',
    blue: '#9ccfd8', magenta: '#c4a7e7', cyan: '#ebbcba', white: '#e0def4',
    brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#31748f', brightYellow: '#f6c177',
    brightBlue: '#9ccfd8', brightMagenta: '#c4a7e7', brightCyan: '#ebbcba', brightWhite: '#e0def4'
  },
  'rose-pine-light': {
    background: '#191724', foreground: '#e0def4', cursor: '#e0def4',
    cursorAccent: '#191724', selectionBackground: '#2a283e',
    black: '#26233a', red: '#eb6f92', green: '#31748f', yellow: '#f6c177',
    blue: '#9ccfd8', magenta: '#c4a7e7', cyan: '#ebbcba', white: '#e0def4',
    brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#31748f', brightYellow: '#f6c177',
    brightBlue: '#9ccfd8', brightMagenta: '#c4a7e7', brightCyan: '#ebbcba', brightWhite: '#e0def4'
  },

  // Vibrant theme - Music streaming inspired with warm gradients
  'vibrant-dark': {
    background: '#121212',
    foreground: '#FFFFFF',
    cursor: '#FF5E62',
    cursorAccent: '#121212',
    selectionBackground: '#404040',
    selectionForeground: '#FFFFFF',
    black: '#121212',
    red: '#FF5E62',
    green: '#1ED760',
    yellow: '#FFBA08',
    blue: '#1DB954',
    magenta: '#A855F7',
    cyan: '#2DD4BF',
    white: '#FFFFFF',
    brightBlack: '#727272',
    brightRed: '#FF7A7D',
    brightGreen: '#34E576',
    brightYellow: '#FFC93C',
    brightBlue: '#34D369',
    brightMagenta: '#C084FC',
    brightCyan: '#5EEAD4',
    brightWhite: '#FFFFFF'
  },
  'vibrant-light': {
    background: '#FFFBFB',
    foreground: '#1F1F1F',
    cursor: '#E11D48',
    cursorAccent: '#FFFBFB',
    selectionBackground: '#FECACA',
    selectionForeground: '#1F1F1F',
    ...ANSI_COLORS.light
  }
}

/**
 * Get terminal theme based on color theme and mode
 */
export function getTerminalTheme(colorTheme: ColorTheme, isDark: boolean): ITheme {
  const mode = isDark ? 'dark' : 'light'
  return TERMINAL_THEMES[`${colorTheme}-${mode}`]
}
