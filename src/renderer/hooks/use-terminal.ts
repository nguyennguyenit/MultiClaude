import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { useSettingsStore } from '../stores'
import { getTerminalTheme } from '@shared/constants'

interface UseTerminalOptions {
  terminalId: string
  onResize?: (cols: number, rows: number) => void
}

/**
 * Get current terminal theme based on settings
 */
function getCurrentTerminalTheme() {
  const { settings } = useSettingsStore.getState()
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && prefersDark)
  return getTerminalTheme(settings.colorTheme, isDark)
}

export function useTerminal({ terminalId, onResize }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  const initTerminal = useCallback(() => {
    if (!containerRef.current || terminalRef.current) return

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: getCurrentTerminalTheme(),
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(containerRef.current)

    // Try WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
    } catch (e) {
      console.warn('WebGL addon failed to load:', e)
    }

    fitAddon.fit()

    // Auto-copy on selection complete
    terminal.element?.addEventListener('mouseup', async () => {
      const selection = terminal.getSelection()
      if (selection) {
        try {
          await navigator.clipboard.writeText(selection)
        } catch {
          // Clipboard permission denied - ignore silently
        }
      }
    })

    // Right-click paste (prevent context menu)
    terminal.element?.addEventListener('contextmenu', async (e) => {
      e.preventDefault()
      try {
        const text = await navigator.clipboard.readText()
        if (text) terminal.paste(text)
      } catch {
        // Clipboard permission denied - ignore silently
      }
    })

    // Handle input
    terminal.onData((data) => {
      window.electron.terminal.write(terminalId, data)
    })

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      window.electron.terminal.resize(terminalId, cols, rows)
      onResize?.(cols, rows)
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Initial resize
    window.electron.terminal.resize(terminalId, terminal.cols, terminal.rows)
  }, [terminalId, onResize])

  // Write data to terminal
  const write = useCallback((data: string) => {
    terminalRef.current?.write(data)
  }, [])

  // Fit terminal to container
  const fit = useCallback(() => {
    fitAddonRef.current?.fit()
  }, [])

  // Focus terminal
  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  // Clear terminal
  const clear = useCallback(() => {
    terminalRef.current?.clear()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminalRef.current?.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => fit()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [fit])

  // Sync terminal theme with app settings
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state) => {
      if (!terminalRef.current) return
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = state.settings.themeMode === 'dark' ||
        (state.settings.themeMode === 'system' && prefersDark)
      terminalRef.current.options.theme = getTerminalTheme(state.settings.colorTheme, isDark)
    })
    return unsubscribe
  }, [])

  return {
    containerRef,
    initTerminal,
    write,
    fit,
    focus,
    clear,
    terminal: terminalRef.current
  }
}
