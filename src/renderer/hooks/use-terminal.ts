import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm, IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore, useToastStore, useImageStore } from '../stores'
import { getTerminalTheme, isAllowedExternalUrl } from '@shared/constants'

// Terminal timing constants (ms)
const TERMINAL_INIT_DELAY = 50  // Delay for WebGL addon & fit after terminal.open()
export const TERMINAL_DISPOSE_DELAY = 100  // Delay to allow xterm's internal setTimeout to complete
const WEBGL_TOGGLE_DEBOUNCE = 50  // Debounce for WebGL toggle on rapid tab switching
const WEBGL_FOCUS_BUFFER = 10  // Extra buffer after WebGL toggle to ensure focus works
const REFRESH_DEBOUNCE = 100  // Debounce refresh to prevent spam
const COPY_TOAST_DEBOUNCE = 2000  // Debounce copy notification to prevent spam on rapid selections
const FONT_LOAD_REFIT_DELAY = 100  // Delay after font load to refit terminal
const CURSOR_RESTORE_DELAY = 300  // Delay after output settles to restore cursor

// Terminal font family - used for font loading detection
const TERMINAL_FONT_FAMILY = 'JetBrains Mono, Menlo, Monaco, Consolas, monospace'
const PRIMARY_FONT = 'JetBrains Mono'

interface UseTerminalOptions {
  terminalId: string
  initialOutput?: string
  isActive?: boolean  // Required for balanced render mode WebGL toggle
  isHidden?: boolean  // Hidden terminals have WebGL disabled to save GPU resources
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
 * Determine if WebGL should be used based on render mode, active state, and hidden state
 * Hidden terminals never use WebGL to save GPU resources
 */
function shouldUseWebGL(isActive: boolean, isHidden: boolean): boolean {
  // Never use WebGL for hidden terminals (saves GPU resources)
  if (isHidden) return false

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

export function useTerminal({ terminalId, initialOutput, isActive = true, isHidden = false, onResize }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const disposedRef = useRef(false)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const isActiveRef = useRef(isActive)
  const isHiddenRef = useRef(isHidden)
  const prevHiddenRef = useRef(isHidden)  // Track previous hidden state for visibility transitions
  const isAtBottomRef = useRef(true)  // Track if viewport is at bottom for smart scroll (non-reactive for write())
  const [isAtBottom, setIsAtBottom] = useState(true)  // Reactive state for UI button visibility
  const savedViewportYRef = useRef<number | null>(null)  // Save viewport line position for restore on project switch
  const scrollDisposableRef = useRef<IDisposable | null>(null)  // Cleanup for onScroll listener
  const viewportScrollHandlerRef = useRef<{ element: Element; handler: () => void } | null>(null)  // Cleanup for viewport scroll listener
  const webglToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const webglLoadingRef = useRef(false)  // Guard against concurrent WebGL loads
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshFnRef = useRef<((showNotification?: boolean) => void) | null>(null)
  const lastCopyToastTimeRef = useRef(0)  // Track last copy notification time for debouncing
  const cursorRestoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)  // Timer for auto cursor restore

  // Helper to attach WebGL context lost listener (defined early to avoid hoisting issues)
  // NOTE: Accesses @xterm/addon-webgl internal API. Tested with v0.18.0.
  // If xterm updates break this, fallback is safe - manual refresh button still works.
  const attachContextLostListener = useCallback((addon: WebglAddon) => {
    // Access WebGL canvas via internal renderer API
    const canvas = (addon as any)._renderer?._renderLayers?.[0]?._canvas as HTMLCanvasElement | undefined
    if (!canvas) return

    const handleContextLost = () => {
      console.warn('WebGL context lost, auto-refreshing terminal...')
      refreshFnRef.current?.(true)  // Show notification on auto-refresh
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)

    // Wrap dispose to cleanup listener
    const originalDispose = addon.dispose.bind(addon)
    addon.dispose = () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      originalDispose()
    }
  }, [])

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
      cursorInactiveStyle: 'block',  // Keep cursor visible when inactive (prevents cursor disappearing on blur)
      fontSize: 14,
      fontFamily: TERMINAL_FONT_FAMILY,
      theme: getCurrentTerminalTheme(),
      allowProposedApi: true,
      windowsMode: false,     // Don't auto-convert \r to \r\n - fixes in-place status line updates
      convertEol: false,      // Don't auto-convert line endings - preserves cursor positioning
      scrollback: 50000       // Large scrollback buffer for extensive CLI output
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(container)

    // Load web links addon for Ctrl+Click URL opening
    const webLinksAddon = new WebLinksAddon(
      (event, uri) => {
        // Only open on Ctrl+Click (Windows/Linux) or Cmd+Click (macOS)
        if (event.ctrlKey || event.metaKey) {
          if (isAllowedExternalUrl(uri)) {
            window.electron.app.openExternal(uri)
          } else {
            useToastStore.getState().addToast('Only http/https URLs can be opened', 'info')
          }
        }
      }
    )
    terminal.loadAddon(webLinksAddon)

    // Helper function to check and update scroll position for smart scroll behavior
    const updateScrollPosition = () => {
      const buffer = terminal.buffer.active
      const linesFromBottom = buffer.baseY - buffer.viewportY
      const SCROLL_THRESHOLD = 5
      const atBottom = linesFromBottom <= SCROLL_THRESHOLD
      isAtBottomRef.current = buffer.viewportY >= buffer.baseY  // Exact for write()
      setIsAtBottom(atBottom)  // With threshold for UI button visibility
      // Note: Scroll position is saved in visibility effect when terminal becomes hidden
    }

    // Track scroll position for smart scroll behavior
    // xterm.js onScroll fires when scrollback buffer changes
    scrollDisposableRef.current = terminal.onScroll(updateScrollPosition)

    // Also listen for scroll events on the terminal viewport for user scroll detection
    // xterm.js onScroll may not fire for all viewport scroll events
    const viewportElement = terminal.element?.querySelector('.xterm-viewport')
    if (viewportElement) {
      viewportElement.addEventListener('scroll', updateScrollPosition)
      viewportScrollHandlerRef.current = { element: viewportElement, handler: updateScrollPosition }
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Defer WebGL addon, fit, and initialOutput to ensure terminal is fully initialized
    // Use setTimeout to run after xterm's internal setTimeout completes
    setTimeout(() => {
      // Guard against disposed terminal
      if (disposedRef.current || !terminalRef.current) return

      // Conditionally load WebGL based on render mode setting
      if (shouldUseWebGL(isActiveRef.current, isHiddenRef.current)) {
        try {
          const webglAddon = new WebglAddon()
          webglAddonRef.current = webglAddon
          terminal.loadAddon(webglAddon)
          attachContextLostListener(webglAddon)
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
        // Save initial viewport line position after output restore
        requestAnimationFrame(() => {
          if (!disposedRef.current && terminalRef.current) {
            savedViewportYRef.current = terminalRef.current.buffer.active.viewportY
          }
        })
      } else {
        // Initial resize only for fresh terminals
        window.electron.terminal.resize(terminalId, terminal.cols, terminal.rows)
      }

      // Font loading detection: refit terminal after primary font loads
      // This fixes character width calculation issues when font loads after terminal init
      if (document.fonts && typeof document.fonts.load === 'function') {
        document.fonts.load(`14px "${PRIMARY_FONT}"`).then(() => {
          if (disposedRef.current || !terminalRef.current || !fitAddonRef.current) return
          // Delay refit slightly to ensure font metrics are fully updated
          setTimeout(() => {
            if (disposedRef.current || !fitAddonRef.current) return
            try {
              fitAddonRef.current.fit()
              // Notify PTY of new dimensions
              if (terminalRef.current) {
                window.electron.terminal.resize(terminalId, terminalRef.current.cols, terminalRef.current.rows)
              }
            } catch {
              // Ignore fit errors
            }
          }, FONT_LOAD_REFIT_DELAY)
        }).catch(() => {
          // Font load failed, fallback font will be used - no action needed
        })
      }
    }, TERMINAL_INIT_DELAY)

    // Auto-copy on selection complete
    // Note: Listeners are implicitly cleaned up when terminal.dispose() destroys the DOM element
    terminal.element?.addEventListener('mouseup', async () => {
      const selection = terminal.getSelection()
      if (selection) {
        try {
          await navigator.clipboard.writeText(selection)
          // Debounce notification to prevent spam on rapid selections
          const now = Date.now()
          if (now - lastCopyToastTimeRef.current > COPY_TOAST_DEBOUNCE) {
            useToastStore.getState().addToast('Copied to clipboard', 'info')
            lastCopyToastTimeRef.current = now
          }
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

    // Intercept global shortcuts before xterm processes them
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true

      // Alt+1~9: Switch project by index (handled by global shortcut)
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        // Allow bubbling to global handler
        return false
      }

      // Ctrl+N or Ctrl+T: New terminal
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 't')) {
        // Allow bubbling to global handler
        return false
      }

      // Ctrl+W: Close active terminal
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        // Allow bubbling to global handler
        return false
      }

      // Ctrl+V paste - detect image in clipboard and save to temp file
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
                // Track image in store for hover preview
                useImageStore.getState().addImage(terminalId, filePath)
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
        }).catch(() => { })
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
  }, [terminalId, initialOutput, onResize, attachContextLostListener])

  // Write data to terminal with auto cursor restore and smart scroll
  const write = useCallback((data: string) => {
    // Save scroll state BEFORE write (xterm auto-scrolls on write)
    const wasAtBottom = isAtBottomRef.current
    const savedY = terminalRef.current?.buffer.active.viewportY ?? 0

    terminalRef.current?.write(data)

    // If user was reading history (not at bottom), restore their scroll position
    if (!wasAtBottom && terminalRef.current && savedY >= 0) {
      terminalRef.current.scrollToLine(savedY)
    }

    // Auto cursor restore: after output settles, send show cursor sequence
    // This fixes cursor disappearing after long CLI output
    if (isActiveRef.current && !isHiddenRef.current) {
      // Clear previous timer
      if (cursorRestoreTimerRef.current) {
        clearTimeout(cursorRestoreTimerRef.current)
      }
      // Set new timer - when no more output for CURSOR_RESTORE_DELAY ms, restore cursor
      cursorRestoreTimerRef.current = setTimeout(() => {
        if (!disposedRef.current && terminalRef.current && isActiveRef.current) {
          terminalRef.current.write('\x1b[?25h')
        }
      }, CURSOR_RESTORE_DELAY)
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

  // Focus terminal (let CLI manage cursor visibility)
  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  // Blur terminal (let CSS handle visibility)
  const blur = useCallback(() => {
    terminalRef.current?.blur()
  }, [])

  // Force show cursor - use when cursor is lost after long output or project switch
  // Uses ANSI sequence + focus (NOT refresh() which can affect scroll position)
  const showCursor = useCallback(() => {
    if (!terminalRef.current || disposedRef.current) return
    terminalRef.current.write('\x1b[?25h')
    terminalRef.current.focus()
  }, [])

  // Clear terminal
  const clear = useCallback(() => {
    terminalRef.current?.clear()
  }, [])

  // Scroll terminal to bottom (for UI button)
  const scrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom()
  }, [])

  // Refresh terminal display (dispose WebGL, redraw, reinit WebGL)
  // Preserves scroll position during refresh
  const refresh = useCallback((showNotification = false) => {
    if (disposedRef.current || !terminalRef.current) return

    // Clear pending refresh
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current)
      refreshDebounceRef.current = null
    }

    refreshDebounceRef.current = setTimeout(() => {
      if (disposedRef.current || !terminalRef.current) return

      // Save viewport line position before refresh (more reliable than DOM scrollTop)
      const savedViewportY = terminalRef.current.buffer.active.viewportY

      // 1. Dispose current WebGL addon
      try {
        webglAddonRef.current?.dispose()
      } catch { /* ignore */ }
      webglAddonRef.current = null

      // 2. Redraw all terminal rows (canvas fallback)
      terminalRef.current.refresh(0, terminalRef.current.rows - 1)

      // 3. Re-init WebGL if needed
      if (shouldUseWebGL(isActiveRef.current, isHiddenRef.current)) {
        try {
          const webglAddon = new WebglAddon()
          webglAddonRef.current = webglAddon
          terminalRef.current.loadAddon(webglAddon)
          attachContextLostListener(webglAddon)
        } catch (e) {
          console.warn('WebGL addon failed to load:', e)
        }
      }

      // 4. Refit
      try {
        fitAddonRef.current?.fit()
      } catch { /* ignore */ }

      // 5. Restore scroll position after refresh using xterm.js API
      if (savedViewportY >= 0) {
        terminalRef.current.scrollToLine(savedViewportY)
      }

      // 6. Show notification if auto-triggered
      if (showNotification) {
        try {
          useToastStore.getState().addToast('Terminal display refreshed', 'info')
        } catch { /* ignore notification errors */ }
      }
    }, REFRESH_DEBOUNCE)
  }, [attachContextLostListener])

  // Keep refreshFnRef in sync with refresh callback for context lost handler
  useEffect(() => {
    refreshFnRef.current = refresh
  }, [refresh])

  // Cleanup on unmount
  useEffect(() => {
    // Reset disposed flag on mount
    disposedRef.current = false

    return () => {
      // Set disposed flag before any cleanup to prevent race conditions
      disposedRef.current = true

      // Clear pending refresh
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
        refreshDebounceRef.current = null
      }

      // Clear cursor restore timer
      if (cursorRestoreTimerRef.current) {
        clearTimeout(cursorRestoreTimerRef.current)
        cursorRestoreTimerRef.current = null
      }

      // Capture refs before nullifying
      const terminal = terminalRef.current
      const fitAddon = fitAddonRef.current
      const webglAddon = webglAddonRef.current
      const scrollDisposable = scrollDisposableRef.current
      const viewportScrollHandler = viewportScrollHandlerRef.current
      terminalRef.current = null
      fitAddonRef.current = null
      webglAddonRef.current = null
      scrollDisposableRef.current = null
      viewportScrollHandlerRef.current = null

      // Cleanup viewport scroll listener
      if (viewportScrollHandler) {
        viewportScrollHandler.element.removeEventListener('scroll', viewportScrollHandler.handler)
      }

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

  // Toggle WebGL addon based on active state, hidden state, and render mode (debounced)
  useEffect(() => {
    isActiveRef.current = isActive
    isHiddenRef.current = isHidden
    if (!terminalRef.current || disposedRef.current) return

    // Clear pending toggle
    if (webglToggleTimerRef.current) {
      clearTimeout(webglToggleTimerRef.current)
      webglToggleTimerRef.current = null
    }

    const toggleWebGL = () => {
      if (disposedRef.current || !terminalRef.current || webglLoadingRef.current) return

      const needsWebGL = shouldUseWebGL(isActiveRef.current, isHiddenRef.current)
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
            attachContextLostListener(webglAddon)
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
  }, [isActive, isHidden, attachContextLostListener])

  // React to render mode setting changes
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return
      if (state.settings.terminalRenderMode === prevState.settings.terminalRenderMode) return

      const needsWebGL = shouldUseWebGL(isActiveRef.current, isHiddenRef.current)
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
            attachContextLostListener(webglAddon)
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
  }, [attachContextLostListener])

  // Visibility transition: save scroll when hiding, restore scroll and cursor when showing
  // Uses useLayoutEffect to capture scroll position BEFORE browser paints display:none
  useLayoutEffect(() => {
    const wasHidden = prevHiddenRef.current
    prevHiddenRef.current = isHidden

    // SAVE scroll position when becoming hidden (synchronously before display:none takes effect)
    if (!wasHidden && isHidden && terminalRef.current) {
      savedViewportYRef.current = terminalRef.current.buffer.active.viewportY
    }

    // RESTORE scroll position and cursor when becoming visible
    if (wasHidden && !isHidden && isActive && terminalRef.current) {
      // Capture saved viewport line position at the moment of transition
      const savedViewportY = savedViewportYRef.current

      // Cancellation flag - set to true when effect cleanup runs
      // This prevents orphaned recursive timers from executing
      let cancelled = false

      const restoreScrollAndCursor = () => {
        if (cancelled || disposedRef.current || !terminalRef.current) return

        // 1. Restore scroll position (no refresh needed - prevents screen jumping)
        if (savedViewportY !== null && savedViewportY > 0) {
          terminalRef.current.scrollToLine(savedViewportY)
        }

        // 2. Force cursor re-render by toggling cursorBlink option
        // This is more reliable than ANSI sequence for WebGL addon scenarios
        terminalRef.current.options.cursorBlink = false
        terminalRef.current.options.cursorBlink = true

        // 3. Also send ANSI sequence as backup
        terminalRef.current.write('\x1b[?25h')

        // 4. Focus terminal
        terminalRef.current.focus()
      }

      // Robust cursor restore with cancellation support
      // Uses polling instead of recursive setTimeout for better cleanup
      const restoreWithWebGLCheck = () => {
        if (cancelled || disposedRef.current || !terminalRef.current || !isActiveRef.current) return

        // If WebGL is still loading, retry after a short delay
        if (webglLoadingRef.current) {
          setTimeout(restoreWithWebGLCheck, 30)
          return
        }

        restoreScrollAndCursor()
      }

      // Multiple stages to handle different timing scenarios:
      // Stage 1: After WebGL toggle completes (80ms)
      const timer1 = setTimeout(restoreWithWebGLCheck, 80)
      // Stage 2: After terminal settles (200ms)
      const timer2 = setTimeout(restoreWithWebGLCheck, 200)
      // Stage 3: Fallback (500ms)
      const timer3 = setTimeout(restoreWithWebGLCheck, 500)
      // Stage 4: Ultimate fallback (1000ms) - for n+ project switching
      const timer4 = setTimeout(restoreWithWebGLCheck, 1000)
      // Stage 5: Final safety net (1500ms) - ensures cursor even on slow systems
      const timer5 = setTimeout(() => {
        if (cancelled || disposedRef.current || !terminalRef.current || !isActiveRef.current) return
        restoreScrollAndCursor()
      }, 1500)

      return () => {
        // Set cancellation flag to stop any pending recursive timers
        cancelled = true
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
        clearTimeout(timer4)
        clearTimeout(timer5)
      }
    }
  }, [isHidden, isActive])

  return {
    containerRef,
    initTerminal,
    write,
    fit,
    focus,
    blur,
    showCursor,
    clear,
    scrollToBottom,
    isAtBottom,
    refresh,
    terminalRef  // Return ref instead of snapshot for live access
  }
}
