import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm, IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { useSettingsStore } from '../stores'
import { getTerminalTheme } from '@shared/constants'

// Terminal timing constants (ms)
const TERMINAL_INIT_DELAY = 50  // Delay for WebGL addon & fit after terminal.open()
export const TERMINAL_DISPOSE_DELAY = 100  // Delay to allow xterm's internal setTimeout to complete
const WEBGL_TOGGLE_DEBOUNCE = 50  // Debounce for WebGL toggle on rapid tab switching

interface UseTerminalOptions {
  terminalId: string
  initialOutput?: string
  isActive?: boolean  // Required for balanced render mode WebGL toggle
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

/**
 * Determine if WebGL should be used based on render mode and active state
 */
function shouldUseWebGL(isActive: boolean): boolean {
  const mode = useSettingsStore.getState().settings.terminalRenderMode ?? 'balanced'
  switch (mode) {
    case 'performance':
      return false
    case 'balanced':
      return isActive
    case 'quality':
      return true
  }
}

export function useTerminal({ terminalId, initialOutput, isActive = true, onResize }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const disposedRef = useRef(false)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const isActiveRef = useRef(isActive)
  const isAtBottomRef = useRef(true)  // Track if viewport is at bottom for smart scroll (non-reactive for write())
  const [isAtBottom, setIsAtBottom] = useState(true)  // Reactive state for UI button visibility
  const scrollDisposableRef = useRef<IDisposable | null>(null)  // Cleanup for onScroll listener
  const webglToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const webglLoadingRef = useRef(false)  // Guard against concurrent WebGL loads

  const initTerminal = useCallback(() => {
    if (disposedRef.current) return
    if (!containerRef.current || terminalRef.current) return

    const container = containerRef.current

    // Ensure container is in DOM and has layout
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      // Container not ready, defer to next frame
      requestAnimationFrame(() => {
        if (!disposedRef.current) initTerminal()
      })
      return
    }

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

    terminal.open(container)

    // Track scroll position for smart scroll behavior
    // viewportY = top visible line; baseY = scrollback lines above viewport
    // When viewportY >= baseY, viewport shows the bottom (cursor area)
    // Use threshold of 5 lines to reduce button flicker
    const SCROLL_THRESHOLD = 5
    scrollDisposableRef.current = terminal.onScroll(() => {
      const buffer = terminal.buffer.active
      const linesFromBottom = buffer.baseY - buffer.viewportY
      const atBottom = linesFromBottom <= SCROLL_THRESHOLD
      isAtBottomRef.current = buffer.viewportY >= buffer.baseY  // Exact for write()
      setIsAtBottom(atBottom)  // With threshold for UI button visibility
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Defer WebGL addon, fit, and initialOutput to ensure terminal is fully initialized
    // Use setTimeout to run after xterm's internal setTimeout completes
    setTimeout(() => {
      // Guard against disposed terminal
      if (disposedRef.current || !terminalRef.current) return

      // Conditionally load WebGL based on render mode setting
      if (shouldUseWebGL(isActiveRef.current)) {
        try {
          const webglAddon = new WebglAddon()
          webglAddonRef.current = webglAddon
          terminal.loadAddon(webglAddon)
        } catch (e) {
          console.warn('WebGL addon failed to load:', e)
        }
      }

      try {
        fitAddon.fit()
      } catch {
        // Ignore fit errors
      }

      // Restore output AFTER WebGL init to prevent race condition
      if (initialOutput) {
        terminal.write(initialOutput)
      } else {
        // Initial resize only for fresh terminals
        window.electron.terminal.resize(terminalId, terminal.cols, terminal.rows)
      }
    }, TERMINAL_INIT_DELAY)

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
        // Write directly to PTY to avoid duplicate from terminal.paste()
        if (text) window.electron.terminal.write(terminalId, text)
      } catch {
        // Clipboard permission denied - ignore silently
      }
    })

    // Ctrl+V paste - detect image in clipboard and save to temp file
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true
      if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) return true

      // Prevent browser's native paste event to avoid duplicate paste from xterm's paste listener
      e.preventDefault()

      navigator.clipboard.read().then(async (clipboardItems) => {
        let hasImage = false

        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith('image/'))
          if (imageType) {
            hasImage = true
            try {
              const blob = await item.getType(imageType)
              const reader = new FileReader()
              const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                  const result = reader.result as string
                  resolve(result.split(',')[1])
                }
                reader.onerror = reject
              })
              reader.readAsDataURL(blob)
              const base64Data = await base64Promise

              const filePath = await window.electron.clipboard.saveImage(base64Data)
              if (filePath) {
                const formatted = /[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(filePath)
                  ? `"${filePath.replace(/"/g, '\\"')}"`
                  : filePath
                window.electron.terminal.write(terminalId, formatted)
              }
            } catch (err) {
              console.error('Failed to process clipboard image:', err)
            }
            break
          }
        }

        if (!hasImage) {
          try {
            const text = await navigator.clipboard.readText()
            // Write directly to PTY - shell will echo back and display via onOutput
            // Do NOT use terminal.paste() as it writes to display AND triggers onData,
            // causing duplicate when PTY echoes back
            if (text) window.electron.terminal.write(terminalId, text)
          } catch {
            // Clipboard permission denied
          }
        }
      }).catch(() => {
        navigator.clipboard.readText().then(text => {
          if (text) window.electron.terminal.write(terminalId, text)
        }).catch(() => {})
      })

      return false
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
  }, [terminalId, initialOutput, onResize])

  // Write data to terminal with smart scroll
  const write = useCallback((data: string) => {
    terminalRef.current?.write(data)
    // Smart scroll: only scroll to bottom if user was at bottom
    if (isAtBottomRef.current) {
      terminalRef.current?.scrollToBottom()
    }
  }, [])

  // Fit terminal to container (with safety check for initialization)
  const fit = useCallback(() => {
    // Only fit if terminal is fully initialized (has valid dimensions)
    if (!terminalRef.current || !fitAddonRef.current) return
    try {
      fitAddonRef.current.fit()
    } catch (e) {
      // Terminal not ready yet - dimensions not available
      // This can happen during initialization race conditions
    }
  }, [])

  // Focus terminal
  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  // Clear terminal
  const clear = useCallback(() => {
    terminalRef.current?.clear()
  }, [])

  // Scroll terminal to bottom (for UI button)
  const scrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    // Reset disposed flag on mount
    disposedRef.current = false

    return () => {
      // Set disposed flag before any cleanup to prevent race conditions
      disposedRef.current = true

      // Capture refs before nullifying
      const terminal = terminalRef.current
      const fitAddon = fitAddonRef.current
      const webglAddon = webglAddonRef.current
      const scrollDisposable = scrollDisposableRef.current
      terminalRef.current = null
      fitAddonRef.current = null
      webglAddonRef.current = null
      scrollDisposableRef.current = null

      // Delay disposal to allow xterm's internal setTimeout callbacks to complete
      // xterm.js uses setTimeout(0) internally for Viewport refresh
      setTimeout(() => {
        try {
          // Order: scroll listener first, WebGL, fit, then terminal
          scrollDisposable?.dispose()
          webglAddon?.dispose()
          fitAddon?.dispose()
          terminal?.dispose()
        } catch {
          // Terminal may already be disposed or in invalid state
        }
      }, TERMINAL_DISPOSE_DELAY)
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

  // Toggle WebGL addon based on active state and render mode (debounced)
  useEffect(() => {
    isActiveRef.current = isActive
    if (!terminalRef.current || disposedRef.current) return

    // Clear pending toggle
    if (webglToggleTimerRef.current) {
      clearTimeout(webglToggleTimerRef.current)
      webglToggleTimerRef.current = null
    }

    const toggleWebGL = () => {
      if (disposedRef.current || !terminalRef.current || webglLoadingRef.current) return

      const needsWebGL = shouldUseWebGL(isActiveRef.current)
      const hasWebGL = webglAddonRef.current !== null

      if (needsWebGL && !hasWebGL) {
        // Load WebGL addon with guard
        webglLoadingRef.current = true
        requestAnimationFrame(() => {
          if (disposedRef.current || !terminalRef.current) {
            webglLoadingRef.current = false
            return
          }
          try {
            const webglAddon = new WebglAddon()
            webglAddonRef.current = webglAddon
            terminalRef.current.loadAddon(webglAddon)
          } catch (e) {
            console.warn('WebGL addon failed to load:', e)
          }
          webglLoadingRef.current = false
        })
      } else if (!needsWebGL && hasWebGL) {
        // Dispose WebGL addon
        try {
          webglAddonRef.current?.dispose()
        } catch {
          // Ignore disposal errors
        }
        webglAddonRef.current = null
      }
    }

    // Debounce toggle to handle rapid tab switching
    webglToggleTimerRef.current = setTimeout(toggleWebGL, WEBGL_TOGGLE_DEBOUNCE)

    return () => {
      if (webglToggleTimerRef.current) {
        clearTimeout(webglToggleTimerRef.current)
        webglToggleTimerRef.current = null
      }
    }
  }, [isActive])

  // React to render mode setting changes
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return
      if (state.settings.terminalRenderMode === prevState.settings.terminalRenderMode) return

      const needsWebGL = shouldUseWebGL(isActiveRef.current)
      const hasWebGL = webglAddonRef.current !== null

      if (needsWebGL && !hasWebGL && !webglLoadingRef.current) {
        webglLoadingRef.current = true
        requestAnimationFrame(() => {
          if (disposedRef.current || !terminalRef.current) {
            webglLoadingRef.current = false
            return
          }
          try {
            const webglAddon = new WebglAddon()
            webglAddonRef.current = webglAddon
            terminalRef.current.loadAddon(webglAddon)
          } catch (e) {
            console.warn('WebGL addon failed to load:', e)
          }
          webglLoadingRef.current = false
        })
      } else if (!needsWebGL && hasWebGL) {
        try {
          webglAddonRef.current?.dispose()
        } catch {
          // Ignore disposal errors
        }
        webglAddonRef.current = null
      }
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
    scrollToBottom,
    isAtBottom,
    terminal: terminalRef.current
  }
}
