/**
 * useTerminalFontTheme — manages font and color-theme subscriptions for xterm.
 *
 * Responsibilities:
 *   - Subscribe to colorTheme / themeMode / uiStyle / colorPreset changes,
 *     update terminal.options.theme and reload WebGL addon if active
 *   - Subscribe to terminalFontFamily changes, update fontFamily option,
 *     then call applyFontMetrics + syncFontAfterLoad
 *   - Provide applyFontMetrics / syncFontAfterLoad helpers
 *
 * Does NOT manage WebGL addon internals — it delegates to onWebGLReload.
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useEffect, useCallback } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useSettingsStore } from '../stores'
import {
  getTerminalTheme,
  TERMINAL_COLOR_PRESETS,
  TERMINAL_FONTS,
  getTerminalFontFamilyById
} from '@shared/constants'

// Delay after font load to allow browser metrics to settle before refitting
const FONT_LOAD_REFIT_DELAY = 100

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPrimaryTerminalFont(): string | null {
  const { pendingSettings } = useSettingsStore.getState()
  const fontId = pendingSettings.terminalFontFamily ?? 'jetbrains-mono'
  const font = TERMINAL_FONTS.find(f => f.id === fontId)
  if (!font || font.id === 'system') return null

  const [primaryFont] = font.family.split(',')
  return primaryFont.trim().replace(/^['"]|['"]$/g, '')
}

/**
 * Build the current xterm theme from settings (includes terminal-preset cursor when in Terminal UI mode).
 */
export function getCurrentTerminalTheme() {
  const { pendingSettings } = useSettingsStore.getState()
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark =
    pendingSettings.themeMode === 'dark' ||
    (pendingSettings.themeMode === 'system' && prefersDark)
  const baseTheme = getTerminalTheme(pendingSettings.colorTheme, isDark)

  if (pendingSettings.uiStyle === 'terminal') {
    const presetId = pendingSettings.terminalStyleOptions?.colorPreset ?? 'green'
    const preset = TERMINAL_COLOR_PRESETS[presetId as keyof typeof TERMINAL_COLOR_PRESETS]
    if (preset) {
      return { ...baseTheme, cursor: preset.accent, cursorAccent: preset.bg }
    }
  }
  return baseTheme
}

// ─── hook ─────────────────────────────────────────────────────────────────────

interface UseTerminalFontThemeParams {
  terminalRef: RefObject<XTerm | null>
  disposedRef: RefObject<boolean>
  terminalId: string
  /** Called after font/size metrics change to refit the terminal */
  onApplyFontMetrics: () => void
  /** Called after a theme change that requires WebGL reload */
  onWebGLReload: () => void
}

export function useTerminalFontTheme(params: UseTerminalFontThemeParams): {
  syncFontAfterLoad: () => void
  applyFontMetrics: () => void
} {
  const { terminalRef, disposedRef, onApplyFontMetrics, onWebGLReload } = params

  // ── applyFontMetrics ──────────────────────────────────────────────────────
  // Exported as callback so initTerminal and the font-change subscriber can call it.
  // Uses onApplyFontMetrics which calls performFit + resize in the orchestrator.
  const applyFontMetrics = useCallback(() => {
    if (disposedRef.current || !terminalRef.current) return
    onApplyFontMetrics()
  }, [disposedRef, onApplyFontMetrics, terminalRef])

  const syncFontAfterLoad = useCallback(() => {
    const primaryFont = getPrimaryTerminalFont()
    if (!primaryFont || !document.fonts || typeof document.fonts.load !== 'function') return

    Promise.allSettled([
      document.fonts.load(`14px "${primaryFont}"`),
      document.fonts.load(`500 14px "${primaryFont}"`)
    ]).then(() => {
      if (disposedRef.current) return

      setTimeout(() => {
        applyFontMetrics()
      }, FONT_LOAD_REFIT_DELAY)
    }).catch(() => {
      // Font load failed — fallback font will be used, no action needed
    })
  }, [applyFontMetrics, disposedRef])

  // ── Theme-change subscription ─────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return

      const themeChanged =
        state.pendingSettings.colorTheme !== prevState.pendingSettings.colorTheme ||
        state.pendingSettings.themeMode !== prevState.pendingSettings.themeMode ||
        state.pendingSettings.uiStyle !== prevState.pendingSettings.uiStyle ||
        state.pendingSettings.terminalStyleOptions?.colorPreset !== prevState.pendingSettings.terminalStyleOptions?.colorPreset

      if (!themeChanged) return

      const newTheme = getCurrentTerminalTheme()
      terminalRef.current.options.theme = newTheme

      // Sync .xterm-viewport and .xterm backgrounds to new theme (xterm v6 no longer
      // auto-syncs either, and our 8px .xterm padding exposes the .xterm bg as a border).
      const xtermEl = terminalRef.current.element as HTMLElement | null
      const viewport = xtermEl?.querySelector('.xterm-viewport') as HTMLElement | null
      if (viewport && newTheme.background) viewport.style.backgroundColor = newTheme.background
      if (xtermEl && newTheme.background) xtermEl.style.backgroundColor = newTheme.background

      // Delegate WebGL reload to orchestrator — it knows about webglAddonRef
      onWebGLReload()
    })
    return unsubscribe
  }, [disposedRef, onWebGLReload, terminalRef])

  // ── Font-change subscription ──────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return
      if (state.pendingSettings.terminalFontFamily === prevState.pendingSettings.terminalFontFamily) return

      terminalRef.current.options.fontFamily = getTerminalFontFamilyById(
        state.pendingSettings.terminalFontFamily ?? 'jetbrains-mono'
      )
      applyFontMetrics()
      syncFontAfterLoad()
    })
    return unsubscribe
  }, [applyFontMetrics, disposedRef, syncFontAfterLoad, terminalRef])

  return { syncFontAfterLoad, applyFontMetrics }
}
