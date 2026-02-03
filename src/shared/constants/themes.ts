import type { ColorThemeDefinition, AppSettings, TerminalColorPreset, TerminalFontId } from '../types'

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

// Terminal UI font options
export const TERMINAL_FONTS: readonly TerminalFontConfig[] = [
  { id: 'jetbrains-mono', name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { id: 'source-code-pro', name: 'Source Code Pro', family: "'Source Code Pro', monospace" },
  { id: 'fira-code', name: 'Fira Code', family: "'Fira Code', monospace" },
  { id: 'vt323', name: 'VT323 (Retro)', family: "'VT323', monospace" },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace" },
  { id: 'space-mono', name: 'Space Mono', family: "'Space Mono', monospace" }
] as const

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

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  colorTheme: 'default',
  terminalLimit: { preset: 9 },
  terminalRenderMode: 'balanced',
  glassmorphismEnabled: false,
  uiStyle: 'modern',
  terminalStyleOptions: {
    colorPreset: 'green',
    fontFamily: 'jetbrains-mono',
    useBorderChars: false
  },
  modernFontFamily: 'jetbrains-mono',
  windowsShell: { type: 'cmd' }
}
