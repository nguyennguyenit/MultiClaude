import type { ITheme } from '@xterm/xterm'
import type { ColorTheme, ThemeMode } from '../types'

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
  }
}

/**
 * Get terminal theme based on color theme and mode
 */
export function getTerminalTheme(colorTheme: ColorTheme, isDark: boolean): ITheme {
  const mode = isDark ? 'dark' : 'light'
  return TERMINAL_THEMES[`${colorTheme}-${mode}`]
}
