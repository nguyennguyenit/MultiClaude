import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm, IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore, useToastStore, useImageStore } from '../stores'
import { getTerminalTheme, isAllowedExternalUrl, TERMINAL_COLOR_PRESETS, TERMINAL_FONTS } from '@shared/constants'
import { shouldBypassXtermShortcut } from '../utils'

// Terminal timing constants (ms)
const TERMINAL_INIT_DELAY = 50  // Delay for WebGL addon & fit after terminal.open()
export const TERMINAL_DISPOSE_DELAY = 100  // Delay to allow xterm's internal setTimeout to complete
const WEBGL_TOGGLE_DEBOUNCE = 50  // Debounce for WebGL toggle on rapid tab switching
const REFRESH_DEBOUNCE = 100  // Debounce refresh to prevent spam
const COPY_TOAST_DEBOUNCE = 2000  // Debounce copy notification to prevent spam on rapid selections
const FONT_LOAD_REFIT_DELAY = 100  // Delay after font load to refit terminal
const TERMINAL_MIN_CONTRAST_RATIO = 4.5  // Keep black-on-gray ANSI spans readable in Codex/Claude output
// NOTE: Cursor restore delay removed - CLI manages its own cursor

// Terminal font family - used for font loading detection
const DEFAULT_FONT_FAMILY = 'JetBrains Mono, Menlo, Monaco, Consolas, monospace'

function getPrimaryTerminalFont(): string | null {
  const { pendingSettings } = useSettingsStore.getState()
  const fontId = pendingSettings.terminalFontFamily ?? 'jetbrains-mono'
  const font = TERMINAL_FONTS.find(f => f.id === fontId)
  if (!font || font.id === 'system') return null

  const [primaryFont] = font.family.split(',')
  return primaryFont.trim().replace(/^['"]|['"]$/g, '')
}

/**
 * Get terminal font family from settings
 */
function getTerminalFontFamily(): string {
  const { pendingSettings } = useSettingsStore.getState()
  const fontId = pendingSettings.terminalFontFamily ?? 'jetbrains-mono'
  const font = TERMINAL_FONTS.find(f => f.id === fontId)
  return font ? `${font.family}, Menlo, Monaco, Consolas, monospace` : DEFAULT_FONT_FAMILY
}

interface UseTerminalOptions {
  terminalId: string
  initialOutput?: string
  isActive?: boolean  // Required for balanced render mode WebGL toggle
  isHidden?: boolean  // Hidden terminals have WebGL disabled to save GPU resources
  onResize?: (cols: number, rows: number) => void
}

/**
 * Get current terminal theme based on settings
 * Uses terminal preset cursor color when in Terminal UI mode
 * Uses color theme cursor color when in Modern UI mode
 */
function getCurrentTerminalTheme() {
  // Use pendingSettings directly (settings getter may not work with getState())
  const { pendingSettings } = useSettingsStore.getState()
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = pendingSettings.themeMode === 'dark' ||
    (pendingSettings.themeMode === 'system' && prefersDark)
  const baseTheme = getTerminalTheme(pendingSettings.colorTheme, isDark)

  // Override cursor with terminal preset color when in Terminal UI mode
  if (pendingSettings.uiStyle === 'terminal') {
    const presetId = pendingSettings.terminalStyleOptions?.colorPreset ?? 'green'
    const preset = TERMINAL_COLOR_PRESETS[presetId as keyof typeof TERMINAL_COLOR_PRESETS]
    if (preset) {
      return { ...baseTheme, cursor: preset.accent, cursorAccent: preset.bg }
    }
  }
  // Modern UI mode: cursor color comes from baseTheme (TERMINAL_THEMES) based on colorTheme
  return baseTheme
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
  const isWritingRef = useRef(false)  // Guard against scroll tracking during programmatic writes
  const [isAtBottom, setIsAtBottom] = useState(true)  // Reactive state for UI button visibility
  const [hasScrollback, setHasScrollback] = useState(false)  // True when buffer has content beyond viewport height
  const savedViewportYRef = useRef<number | null>(null)  // Save viewport line position for restore on project switch
  const scrollDisposableRef = useRef<IDisposable | null>(null)  // Cleanup for onScroll listener
  const viewportScrollHandlerRef = useRef<{ element: Element; handler: () => void } | null>(null)  // Cleanup for viewport scroll listener
  const webglToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const webglLoadingRef = useRef(false)  // Guard against concurrent WebGL loads
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshFnRef = useRef<((showNotification?: boolean) => void) | null>(null)
  const lastCopyToastTimeRef = useRef(0)  // Track last copy notification time for debouncing

  // Helper to attach WebGL context lost listener via the public addon API.
  const attachContextLostListener = useCallback((addon: WebglAddon) => {
    const contextLossDisposable = addon.onContextLoss(() => {
      console.warn('WebGL context lost, auto-refreshing terminal...')
      refreshFnRef.current?.(true)  // Show notification on auto-refresh
    })

    // Wrap dispose to cleanup listener
    const originalDispose = addon.dispose.bind(addon)
    addon.dispose = () => {
      contextLossDisposable.dispose()
      originalDispose()
    }
  }, [])

  const clearTextureAtlas = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal || disposedRef.current) return

    try {
      terminal.clearTextureAtlas()
    } catch {
      // Ignore atlas resets during initialization/teardown races
    }
  }, [])

  // Repaint visible rows after renderer/visibility transitions.
  const refreshVisibleRows = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal || disposedRef.current || terminal.rows <= 0) return

    try {
      terminal.refresh(0, terminal.rows - 1)
    } catch {
      // Ignore refresh errors during initialization/teardown races
    }
  }, [])

  // Refit when a terminal becomes visible again so xterm recalculates cols/rows
  // before TUIs redraw status lines or right-aligned badges.
  const fitVisibleTerminal = useCallback(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (!terminal || !fitAddon || disposedRef.current) return

    try {
      fitAddon.fit()
    } catch {
      // Ignore fit errors if layout is not ready yet
    }
  }, [])

  const reconcileVisibleTerminal = useCallback((savedViewportY: number | null) => {
    if (!terminalRef.current || disposedRef.current) return

    clearTextureAtlas()
    fitVisibleTerminal()
    refreshVisibleRows()

    if (savedViewportY !== null && savedViewportY > 0 && terminalRef.current) {
      terminalRef.current.scrollToLine(savedViewportY)
    }
  }, [clearTextureAtlas, fitVisibleTerminal, refreshVisibleRows])

  const applyFontMetrics = useCallback(() => {
    if (disposedRef.current || !terminalRef.current || !fitAddonRef.current) return

    clearTextureAtlas()

    if (!isHiddenRef.current) {
      try {
        fitAddonRef.current.fit()
      } catch {
        // Ignore fit errors if layout is not ready yet
      }
    }

    refreshVisibleRows()
    window.electron.terminal.resize(terminalId, terminalRef.current.cols, terminalRef.current.rows)
  }, [clearTextureAtlas, refreshVisibleRows, terminalId])

  const syncFontAfterLoad = useCallback(() => {
    const primaryFont = getPrimaryTerminalFont()
    if (!primaryFont || !document.fonts || typeof document.fonts.load !== 'function') return

    Promise.allSettled([
      document.fonts.load(`14px "${primaryFont}"`),
      document.fonts.load(`500 14px "${primaryFont}"`)
    ]).then(() => {
      if (disposedRef.current) return

      // Delay slightly to ensure browser font metrics have settled.
      setTimeout(() => {
        applyFontMetrics()
      }, FONT_LOAD_REFIT_DELAY)
    }).catch(() => {
      // Font load failed, fallback font will be used - no action needed
    })
  }, [applyFontMetrics])

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
      cursorStyle: 'bar',
      cursorInactiveStyle: 'bar',  // Keep cursor visible when inactive (prevents cursor disappearing on blur)
      fontSize: 14,
      fontFamily: getTerminalFontFamily(),
      theme: getCurrentTerminalTheme(),
      minimumContrastRatio: TERMINAL_MIN_CONTRAST_RATIO,
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
      if (isWritingRef.current) return  // Skip during programmatic writes to avoid race condition
      const buffer = terminal.buffer.active
      const linesFromBottom = buffer.baseY - buffer.viewportY
      const SCROLL_THRESHOLD = 5
      const atBottom = linesFromBottom <= SCROLL_THRESHOLD
      isAtBottomRef.current = buffer.viewportY >= buffer.baseY  // Exact for write()
      setIsAtBottom(atBottom)  // With threshold for UI button visibility
      setHasScrollback(buffer.baseY > 0)  // Track if any scrollback content exists
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

      // Refit and clear cached glyphs after the active font finishes loading.
      syncFontAfterLoad()
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
      // Block all DOM keyboard event phases for app-level shortcuts so xterm
      // does not emit modified-key control sequences into the PTY.
      if (shouldBypassXtermShortcut(e)) {
        return false
      }

      if (e.type !== 'keydown') return true

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

    // Fix Vietnamese IME on macOS: The IME uses backspace mode (no composition API)
    // and sends Backspace count based on its internal NFD buffer length.
    // macOS NFD: "à" = U+0061 + U+0300 (2 code points) → IME sends 2 DELs.
    // But we send NFC to PTY: "à" = U+00E0 (1 code point) → shell needs 1 DEL.
    // Track the NFC/NFD length difference as "debt" and swallow extra DELs.
    // Debt resets when regular (non-NFD) text is typed.
    let imeDelDebt = 0

    terminal.onData((data) => {
      // Single DEL: swallow if debt > 0 (extra DEL from IME NFD mismatch)
      if (data === '\x7f') {
        if (imeDelDebt > 0) {
          imeDelDebt--
          return
        }
        window.electron.terminal.write(terminalId, data)
        return
      }

      // Normalize to NFC and track debt
      const nfcData = data.normalize('NFC')
      const origLen = [...data].length
      const nfcLen = [...nfcData].length

      if (origLen > nfcLen) {
        // NFD text (has combining marks): accumulate debt
        imeDelDebt += origLen - nfcLen
      } else {
        // Regular text: reset debt (IME replacement cycle complete)
        imeDelDebt = 0
      }

      window.electron.terminal.write(terminalId, nfcData)
    })

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      window.electron.terminal.resize(terminalId, cols, rows)
      onResize?.(cols, rows)
    })
  }, [terminalId, initialOutput, onResize, attachContextLostListener, syncFontAfterLoad])

  // Write data to terminal with auto cursor restore and smart scroll
  const write = useCallback((data: string) => {
    if (!terminalRef.current) return

    // Save scroll state BEFORE write (xterm auto-scrolls on write)
    const wasAtBottom = isAtBottomRef.current
    const savedY = terminalRef.current.buffer.active.viewportY

    // Suppress scroll tracking during write to prevent race condition
    // where onScroll fires at intermediate state (viewportY < baseY)
    isWritingRef.current = true

    terminalRef.current.write(data, () => {
      // Callback fires AFTER xterm fully processes data — safe to update state
      isWritingRef.current = false

      // If user was reading history (not at bottom), restore their scroll position
      if (!wasAtBottom && terminalRef.current && savedY >= 0) {
        terminalRef.current.scrollToLine(savedY)
      }
    })

    // NOTE: Removed auto cursor restore - it interferes with Claude Code CLI's cursor positioning
    // Claude Code manages its own cursor via escape sequences for status line rendering
  }, [])

  // Fit terminal to container (with safety check for initialization)
  const fit = useCallback(() => {
    // Only fit if terminal is fully initialized (has valid dimensions)
    if (!terminalRef.current || !fitAddonRef.current) return
    try {
      fitAddonRef.current.fit()
    } catch {
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

  // Focus terminal and let CLI manage cursor visibility
  // NOTE: Removed ANSI cursor show sequence - it interferes with Claude Code's cursor positioning
  const showCursor = useCallback(() => {
    if (!terminalRef.current || disposedRef.current) return
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

      clearTextureAtlas()

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
  }, [attachContextLostListener, clearTextureAtlas])

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

      // Reset writing flag on dispose
      isWritingRef.current = false

      // Clear pending refresh
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
        refreshDebounceRef.current = null
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

  // Sync terminal theme with app settings (includes terminal preset cursor)
  // Must reload WebGL addon to apply cursor color changes
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return

      const themeChanged =
        state.pendingSettings.colorTheme !== prevState.pendingSettings.colorTheme ||
        state.pendingSettings.themeMode !== prevState.pendingSettings.themeMode ||
        state.pendingSettings.uiStyle !== prevState.pendingSettings.uiStyle ||
        state.pendingSettings.terminalStyleOptions?.colorPreset !== prevState.pendingSettings.terminalStyleOptions?.colorPreset

      if (!themeChanged) return

      terminalRef.current.options.theme = getCurrentTerminalTheme()
      clearTextureAtlas()

      // WebGL addon caches cursor color - must dispose and reload to apply changes
      if (webglAddonRef.current) {
        try {
          webglAddonRef.current.dispose()
        } catch { /* ignore */ }
        webglAddonRef.current = null

        // Redraw with canvas fallback first
        terminalRef.current.refresh(0, terminalRef.current.rows - 1)

        // Reload WebGL addon with new theme
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
      } else {
        // No WebGL - simple refresh is enough
        terminalRef.current.refresh(0, terminalRef.current.rows - 1)
      }
    })
    return unsubscribe
  }, [attachContextLostListener, clearTextureAtlas])

  // Sync terminal font changes for already-mounted terminals.
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return
      if (state.pendingSettings.terminalFontFamily === prevState.pendingSettings.terminalFontFamily) return

      terminalRef.current.options.fontFamily = getTerminalFontFamily()
      applyFontMetrics()
      syncFontAfterLoad()
    })
    return unsubscribe
  }, [applyFontMetrics, syncFontAfterLoad])

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
            refreshVisibleRows()
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
        refreshVisibleRows()
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
  }, [isActive, isHidden, attachContextLostListener, refreshVisibleRows])

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
            refreshVisibleRows()
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
        refreshVisibleRows()
      }
    })
    return unsubscribe
  }, [attachContextLostListener, refreshVisibleRows])

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

        // Refit and repaint after project switch so renderer changes and any
        // hidden-layout drift do not leave stale TUI fragments on screen.
        reconcileVisibleTerminal(savedViewportY)

        // 2. Focus terminal - let CLI manage its own cursor
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
  }, [isHidden, isActive, reconcileVisibleTerminal])

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
    hasScrollback,
    refresh,
    terminalRef  // Return ref instead of snapshot for live access
  }
}
