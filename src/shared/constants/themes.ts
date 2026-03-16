import type { ColorThemeDefinition, AppSettings, TerminalColorPreset, TerminalFontId, AppFontId } from '../types'

// ============================================
// VibeTerminal Theme System
// ============================================

/** Unified theme with UI colors + full ANSI 16-color palette */
export interface VibeTheme {
  id: string
  name: string
  // UI colors
  background: string
  foreground: string
  accent: string
  border: string
  tabBg: string
  tabActiveBg: string
  hover: string
  cursor: string
  selectionBg: string
  // ANSI 16 colors (for xterm)
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

/** 5 curated VibeTerminal themes */
export const THEMES: VibeTheme[] = [
  {
    id: 'tokyo-night', name: 'Tokyo Night',
    background: '#1a1b26', foreground: '#c0caf5', accent: '#7aa2f7',
    border: '#292e42', tabBg: '#16161e', tabActiveBg: '#1a1b26',
    hover: '#292e42', cursor: '#c0caf5', selectionBg: '#283457',
    black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
    blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
    brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68',
    brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5'
  },
  {
    id: 'catppuccin', name: 'Catppuccin Mocha',
    background: '#1e1e2e', foreground: '#cdd6f4', accent: '#89b4fa',
    border: '#313244', tabBg: '#181825', tabActiveBg: '#1e1e2e',
    hover: '#313244', cursor: '#f5e0dc', selectionBg: '#45475a',
    black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
    blue: '#89b4fa', magenta: '#cba6f7', cyan: '#94e2d5', white: '#bac2de',
    brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
    brightBlue: '#89b4fa', brightMagenta: '#cba6f7', brightCyan: '#94e2d5', brightWhite: '#a6adc8'
  },
  {
    id: 'dracula', name: 'Dracula',
    background: '#282a36', foreground: '#f8f8f2', accent: '#bd93f9',
    border: '#44475a', tabBg: '#21222c', tabActiveBg: '#282a36',
    hover: '#44475a', cursor: '#f8f8f2', selectionBg: '#44475a',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
    brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
  },
  {
    id: 'rose-pine', name: 'Rosé Pine',
    background: '#191724', foreground: '#e0def4', accent: '#c4a7e7',
    border: '#26233a', tabBg: '#1f1d2e', tabActiveBg: '#191724',
    hover: '#26233a', cursor: '#e0def4', selectionBg: '#2a283e',
    black: '#26233a', red: '#eb6f92', green: '#31748f', yellow: '#f6c177',
    blue: '#9ccfd8', magenta: '#c4a7e7', cyan: '#ebbcba', white: '#e0def4',
    brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#31748f', brightYellow: '#f6c177',
    brightBlue: '#9ccfd8', brightMagenta: '#c4a7e7', brightCyan: '#ebbcba', brightWhite: '#e0def4'
  },
  {
    id: 'pro-dark', name: 'Pro Dark',
    background: '#0d1117', foreground: '#e6edf3', accent: '#3b82f6',
    border: '#30363d', tabBg: '#010409', tabActiveBg: '#0d1117',
    hover: '#161b22', cursor: '#e6edf3', selectionBg: '#264f78',
    black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
    blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
    brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#e3b341',
    brightBlue: '#79c0ff', brightMagenta: '#d2a8ff', brightCyan: '#56d4dd', brightWhite: '#f0f6fc'
  }
]

// ============================================
// Legacy Theme System (kept for backward compat)
// ============================================

// Terminal UI color preset configuration
export interface TerminalColorPresetConfig {
  id: TerminalColorPreset
  name: string
  bg: string
  text: string
  textSecondary: string
  accent: string
  border: string
}

// Terminal UI color presets
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
} as const satisfies Record<TerminalColorPreset, TerminalColorPresetConfig>

// Terminal UI font configuration
export interface TerminalFontConfig {
  id: TerminalFontId
  name: string
  family: string
}

// App/UI (non-terminal) font configuration
export interface AppFontConfig {
  id: AppFontId
  name: string
  family: string
}

// App/UI font options - sans-serif fonts for the main interface
export const APP_FONTS: readonly AppFontConfig[] = [
  { id: 'system', name: 'System Default', family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif" },
  { id: 'inter', name: 'Inter', family: "'Inter', sans-serif" },
  { id: 'geist', name: 'Geist', family: "'Geist', sans-serif" },
  { id: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif" },
  { id: 'roboto', name: 'Roboto', family: "'Roboto', sans-serif" },
  { id: 'ubuntu', name: 'Ubuntu', family: "'Ubuntu', sans-serif" },
  { id: 'segoe-ui', name: 'Segoe UI', family: "'Segoe UI', sans-serif" },
] as const

// Terminal UI font options
export const TERMINAL_FONTS: readonly TerminalFontConfig[] = [
  { id: 'system', name: 'System Default', family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif" },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { id: 'source-code-pro', name: 'Source Code Pro', family: "'Source Code Pro', monospace" },
  { id: 'fira-code', name: 'Fira Code', family: "'Fira Code', monospace" },
  { id: 'vt323', name: 'VT323 (Retro)', family: "'VT323', monospace" },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace" },
  { id: 'space-mono', name: 'Space Mono', family: "'Space Mono', monospace" }
] as const

const TERMINAL_SYMBOL_FONT_FALLBACKS = [
  "'Symbols Nerd Font Mono'",
  "'Symbols Nerd Font'",
  "'MesloLGS NF'",
  "'MesloLGM Nerd Font Mono'",
  "'Hack Nerd Font Mono'",
  "'SauceCodePro Nerd Font Mono'",
  "'FiraCode Nerd Font Mono'",
  "'JetBrainsMono Nerd Font Mono'",
  "'Noto Sans Symbols 2'",
  "'Noto Sans Symbols'",
  "'Apple Symbols'",
  "'Segoe UI Symbol'",
  "'Apple Color Emoji'",
  "'Segoe UI Emoji'",
  "'Noto Color Emoji'"
] as const

const TERMINAL_MONOSPACE_FALLBACKS = [
  'Menlo',
  'Monaco',
  'Consolas',
  'monospace'
] as const

/**
 * Build a terminal font stack that keeps the selected monospace face first,
 * but falls back to common Nerd/symbol fonts for Claude Code prompt glyphs.
 */
export function buildTerminalFontFamily(primaryFamily: string): string {
  const families = [
    ...primaryFamily.split(',').map(family => family.trim()).filter(Boolean),
    ...TERMINAL_SYMBOL_FONT_FALLBACKS,
    ...TERMINAL_MONOSPACE_FALLBACKS
  ]

  return Array.from(new Set(families)).join(', ')
}

export function getTerminalFontFamilyById(fontId: TerminalFontId = 'jetbrains-mono'): string {
  const font = TERMINAL_FONTS.find(f => f.id === fontId)
  return buildTerminalFontFamily(font?.family ?? "'JetBrains Mono', monospace")
}

export const COLOR_THEMES: ColorThemeDefinition[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Classic dark with pale yellow accent',
    previewColors: { bg: '#F2F2ED', accent: '#E6E7A3', darkBg: '#0B0B0F', darkAccent: '#E6E7A3' }
  },
  {
    id: 'dusk',
    name: 'Dusk',
    description: 'Warm variant with lighter dark mode',
    previewColors: { bg: '#F5F5F0', accent: '#E6E7A3', darkBg: '#131419', darkAccent: '#E6E7A3' }
  },
  {
    id: 'lime',
    name: 'Lime',
    description: 'Energetic lime with purple accents',
    previewColors: { bg: '#E8F5A3', accent: '#7C3AED', darkBg: '#0F0F1A' }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calm, professional blue tones',
    previewColors: { bg: '#E0F2FE', accent: '#0284C7', darkBg: '#082F49' }
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Warm, nostalgic amber vibes',
    previewColors: { bg: '#FEF3C7', accent: '#D97706', darkBg: '#1C1917' }
  },
  {
    id: 'neo',
    name: 'Neo',
    description: 'Modern cyberpunk pink/magenta',
    previewColors: { bg: '#FDF4FF', accent: '#D946EF', darkBg: '#0F0720' }
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Natural, earthy green tones',
    previewColors: { bg: '#DCFCE7', accent: '#16A34A', darkBg: '#052E16' }
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    description: 'DeFi/crypto inspired cyberpunk with neon cyan',
    previewColors: { bg: '#EDF8FF', accent: '#0095A3', darkBg: '#0A0E17', darkAccent: '#00E5FF' }
  },
  {
    id: 'pro-dark',
    name: 'Pro Dark',
    description: 'Professional trading platform with clean aesthetics',
    previewColors: { bg: '#F6F8FA', accent: '#2563EB', darkBg: '#0D1117', darkAccent: '#3B82F6' }
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    description: 'Bold music streaming inspired with warm gradients',
    previewColors: { bg: '#FFFBFB', accent: '#E11D48', darkBg: '#121212', darkAccent: '#FF5E62' }
  }
]

// Default Activity Bar state
export const DEFAULT_ACTIVITY_BAR_STATE = 'collapsed' as const

export const DEFAULT_SETTINGS: AppSettings = {
  colorTheme: 'tokyo-night',
  terminalLimit: { preset: 9 },
  terminalRenderMode: 'balanced',
  glassmorphismEnabled: false,
  terminalFontFamily: 'jetbrains-mono',
  windowsShell: { type: 'cmd' },
  // Legacy fields - kept for backward compat with saved user settings + use-terminal hook
  themeMode: 'dark',
  modernFontFamily: 'system',
  uiStyle: 'modern',
  terminalStyleOptions: {
    colorPreset: 'green',
    fontFamily: 'jetbrains-mono',
    useBorderChars: false
  },
  activityBarState: DEFAULT_ACTIVITY_BAR_STATE,
  vietnameseImeFix: false,
  vietnameseImeClaudeVersion: undefined,
  vietnameseImeClaudePath: undefined
}
