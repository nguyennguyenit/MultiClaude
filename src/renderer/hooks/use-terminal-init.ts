/**
 * useTerminalInit — constructs and configures the XTerm instance.
 *
 * Responsibilities:
 *   - Create XTerm with correct options (font, theme, cursor, scrollback)
 *   - Load FitAddon and WebLinksAddon
 *   - Call terminal.open(container) and attach all addons
 *   - Restore initialOutput and initialViewportY after WebGL loads
 *   - Set up scroll listener and viewport interaction listeners
 *   - Attach custom key event handler (keyboard shortcuts, enhanced Enter, Ctrl+V)
 *   - Set up Vietnamese IME DEL-debt correction on onData
 *   - Handle terminal resize events
 *
 * Exposes initTerminal() — the orchestrator returns it to the component.
 *
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import { Terminal as XTerm, IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { TerminalScrollMachine } from '../utils/terminal-scroll-machine'
import type { UserScrollIntent } from '../utils/terminal-scroll-utils'
import {
  isViewportNearBottom,
  isPointerOnViewportScrollbar,
  createUserScrollIntent,
  TERMINAL_SCROLL_THRESHOLD,
} from '../utils/terminal-scroll-utils'
import { stripLeakedTerminalResponses } from '../utils/terminal-output-utils'
import { useSettingsStore, useToastStore, useImageStore } from '../stores'
import { getTerminalFontFamilyById, isAllowedExternalUrl, SCROLLBACK_DEFAULT, SCROLLBACK_MIN, SCROLLBACK_MAX } from '@shared/constants'
import { shouldBypassXtermShortcut } from '../utils'
import { getCsiUEnterSequence } from '../utils/keyboard-enhancement-utils'
import { getCurrentTerminalTheme } from './use-terminal-font-theme'

const TERMINAL_INIT_DELAY = 50         // ms after terminal.open() before loading addons
const TERMINAL_MIN_CONTRAST_RATIO = 2.0
const USER_SCROLL_WHEEL_GRACE = 180    // ms wheel-scroll intent grace period
const USER_SCROLL_DRAG_GRACE = 1200   // ms scrollbar-drag intent grace period

// Clamp scrollback to the allowed range; fall back to default when value is
// missing/corrupted so a stale stored setting can never disable scrollback.
export function clampScrollback(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return SCROLLBACK_DEFAULT
  return Math.min(SCROLLBACK_MAX, Math.max(SCROLLBACK_MIN, Math.floor(value)))
}


interface ViewportEventListener {
  target: EventTarget
  type: string
  handler: EventListener
}

interface UseTerminalInitParams {
  terminalRef: RefObject<XTerm | null>
  fitAddonRef: RefObject<FitAddon | null>
  disposedRef: RefObject<boolean>
  containerRef: RefObject<HTMLDivElement | null>
  terminalId: string
  initialOutput?: string
  initialViewportY?: number | null
  isActiveRef: RefObject<boolean>
  isHiddenRef: RefObject<boolean>
  scrollMachineRef: RefObject<TerminalScrollMachine>
  userViewportInteractingRef: RefObject<boolean>
  viewportListenersRef: RefObject<ViewportEventListener[] | null>
  scrollDisposableRef: RefObject<IDisposable | null>
  syncViewportState: (buffer: XTerm['buffer']['active'], intent?: UserScrollIntent | null) => void
  clearUserViewportInteraction: () => void
  markUserViewportInteraction: (durationMs: number) => void
  shouldSendEnhancedEnter: () => boolean
  attachClipboardListeners: (terminal: XTerm) => void
  getCtrlVHandler: (terminal: XTerm) => (e: KeyboardEvent) => boolean | undefined
  followLiveOutput: () => void
  reconcileWebGL: () => void
  syncFontAfterLoad: () => void
  registerTerminalDebugHandle: () => void
  /** v6: called in terminal.onWriteParsed for post-parse scroll snapshot update */
  onWriteParsed: () => void
  onResize?: (cols: number, rows: number) => void
}

interface UseTerminalInitResult {
  initTerminal: () => void
}

export function useTerminalInit(params: UseTerminalInitParams): UseTerminalInitResult {
  const {
    terminalRef,
    fitAddonRef,
    disposedRef,
    containerRef,
    terminalId,
    initialOutput,
    initialViewportY = null,
    isActiveRef,
    isHiddenRef,
    scrollMachineRef,
    userViewportInteractingRef,
    viewportListenersRef,
    scrollDisposableRef,
    syncViewportState,
    clearUserViewportInteraction,
    markUserViewportInteraction,
    shouldSendEnhancedEnter,
    attachClipboardListeners,
    getCtrlVHandler,
    followLiveOutput,
    reconcileWebGL,
    syncFontAfterLoad,
    registerTerminalDebugHandle,
    onWriteParsed,
    onResize,
  } = params

  // Keep a stable ref to initialOutput so initTerminal callback doesn't rebuild every render
  const initialOutputRef = useRef(initialOutput)
  const initialViewportYRef = useRef(initialViewportY)

  const initTerminal = useCallback(() => {
    if (disposedRef.current) return
    if (!containerRef.current || terminalRef.current) return

    const container = containerRef.current

    // Ensure container has layout before creating the terminal
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      requestAnimationFrame(() => {
        if (!disposedRef.current) initTerminal()
      })
      return
    }

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorInactiveStyle: 'bar',
      fontSize: 14,
      fontFamily: getTerminalFontFamilyById(
        useSettingsStore.getState().pendingSettings.terminalFontFamily ?? 'jetbrains-mono'
      ),
      theme: getCurrentTerminalTheme(),
      minimumContrastRatio: TERMINAL_MIN_CONTRAST_RATIO,
      allowProposedApi: true,
      convertEol: false,
      scrollback: clampScrollback(useSettingsStore.getState().pendingSettings.scrollbackLines),
      reflowCursorLine: true,   // v6: include cursor line in reflow on resize
      // OSC 8 hyperlinks: CLIs (e.g. Claude Code) emit explicit hyperlink metadata
      // that survives line-wrapping. Without this handler, clicks fall back to
      // WebLinksAddon regex scanning wrapped buffer text — which can miss the tail
      // of very long URLs. Using the OSC 8 payload guarantees the full URL.
      linkHandler: {
        activate: (event, text) => {
          if (event.button !== 0) return
          if (isAllowedExternalUrl(text)) {
            window.electron.app.openExternal(text)
          } else {
            useToastStore.getState().addToast('Only http/https URLs can be opened', 'info')
          }
        }
      }
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(container)

    // xterm v6 removed the v5 auto-sync of .xterm-viewport background-color.
    // Both .xterm-viewport (covers content box) and .xterm (8px padding strip,
    // since .xterm-viewport is abs-positioned inside the padding box) could
    // leak #000 through to the terminal-container bg, showing as a border when
    // theme bg differs from --bg-primary. Fix: globals.css paints both with
    // var(--terminal-bg), which App.tsx writes to :root whenever the xterm
    // theme could change — so all terminals (incl. ones mounted before the
    // theme flip) pick it up reactively without per-instance inline style.

    // ── WebLinks addon ───────────────────────────────────────────────────────
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      if (event.button !== 0) return
      if (isAllowedExternalUrl(uri)) {
        window.electron.app.openExternal(uri)
      } else {
        useToastStore.getState().addToast('Only http/https URLs can be opened', 'info')
      }
    })
    terminal.loadAddon(webLinksAddon)

    // ── Scroll / viewport listeners ──────────────────────────────────────────
    const syncScrollPosition = (captureUserIntent = false) => {
      const scrollMachine = scrollMachineRef.current
      const buffer = terminal.buffer.active
      const hiddenViewportIntent = isHiddenRef.current ? scrollMachine.hiddenViewportIntent : null

      if (hiddenViewportIntent && !captureUserIntent) {
        syncViewportState(buffer, hiddenViewportIntent)
        return
      }

      const atBottom = isViewportNearBottom(
        buffer.baseY,
        buffer.viewportY,
        TERMINAL_SCROLL_THRESHOLD
      )

      if (captureUserIntent) {
        scrollMachine.followOutputOnNextWrite = atBottom
      }

      if (scrollMachine.pendingWriteCount > 0 && !captureUserIntent) return

      if (scrollMachine.pendingWriteCount > 0 && captureUserIntent) {
        scrollMachine.pendingUserScrollIntent = createUserScrollIntent(
          buffer.baseY,
          buffer.viewportY,
          TERMINAL_SCROLL_THRESHOLD
        )
      }

      scrollMachine.isAtBottom = atBottom
      syncViewportState(buffer, hiddenViewportIntent)
    }

    scrollDisposableRef.current = terminal.onScroll(() => syncScrollPosition(false))
    // v6: fires after each chunk is parsed, before render — used to refresh scroll snapshot
    terminal.onWriteParsed(onWriteParsed)

    const viewportElement = terminal.element?.querySelector('.xterm-viewport') as HTMLElement | null
    if (viewportElement) {
      const viewportListeners: ViewportEventListener[] = []
      const addViewportListener = (target: EventTarget, type: string, handler: EventListener) => {
        target.addEventListener(type, handler)
        viewportListeners.push({ target, type, handler })
      }

      addViewportListener(viewportElement, 'scroll', () => syncScrollPosition(userViewportInteractingRef.current))
      addViewportListener(viewportElement, 'wheel', () => markUserViewportInteraction(USER_SCROLL_WHEEL_GRACE))
      addViewportListener(viewportElement, 'pointerdown', (event) => {
        if (!(event instanceof PointerEvent)) return
        if (!isPointerOnViewportScrollbar({
          clientX: event.clientX,
          viewportClientWidth: viewportElement.clientWidth,
          viewportOffsetWidth: viewportElement.offsetWidth,
          viewportRight: viewportElement.getBoundingClientRect().right
        })) return

        markUserViewportInteraction(USER_SCROLL_DRAG_GRACE)
      })
      addViewportListener(window, 'pointerup', clearUserViewportInteraction)
      addViewportListener(window, 'pointercancel', clearUserViewportInteraction)
      addViewportListener(viewportElement, 'touchstart', () => markUserViewportInteraction(USER_SCROLL_DRAG_GRACE))
      addViewportListener(viewportElement, 'touchend', clearUserViewportInteraction)
      addViewportListener(viewportElement, 'touchcancel', clearUserViewportInteraction)

      viewportListenersRef.current = viewportListeners
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    registerTerminalDebugHandle()

    // ── Clipboard listeners ──────────────────────────────────────────────────
    attachClipboardListeners(terminal)

    // ── Deferred initialisation (WebGL, fit, restore) ────────────────────────
    setTimeout(() => {
      if (disposedRef.current || !terminalRef.current) return

      // Conditionally load WebGL — delegated to reconcileWebGL which handles
      // shouldUseWebGL(), addon construction, and context-loss listener setup
      reconcileWebGL()

      try {
        fitAddon.fit()
      } catch {
        // Ignore fit errors during early init
      }

      const restoreInitialViewport = () => {
        if (disposedRef.current || !terminalRef.current) return
        if (initialViewportYRef.current !== null && initialViewportYRef.current >= 0) {
          terminalRef.current.scrollToLine(initialViewportYRef.current)
        }
        scrollMachineRef.current.savedViewportY = terminalRef.current.buffer.active.viewportY
        syncScrollPosition(false)
      }

      if (initialOutputRef.current) {
        terminal.write(stripLeakedTerminalResponses(initialOutputRef.current), () => {
          requestAnimationFrame(restoreInitialViewport)
        })
      } else {
        // No prop-provided initialOutput — fetch snapshot from backend.
        // Live chunks arriving during this await are tolerated: they append after
        // snapshot write, producing correct final state (no data loss, no reset
        // conflict). No pauseAndBuffer here — delaying first prompt would be noticeable.
        // V2 design decision: snapshot is clean PTY state, so stripLeakedTerminalResponses
        // is intentionally NOT applied (snapshot has no raw PTY leak artifacts).
        window.electron.terminal.getSnapshot(terminalId).then(snap => {
          if (disposedRef.current || !terminalRef.current) return
          if (snap.data) {
            terminal.write(snap.data, () => {
              requestAnimationFrame(restoreInitialViewport)
            })
          } else {
            // Empty snapshot (fresh terminal) — just restore viewport + send SIGWINCH
            requestAnimationFrame(restoreInitialViewport)
            window.electron.terminal.resize(terminalId, terminal.cols, terminal.rows)
          }
        }).catch(() => {
          // Snapshot fetch failed — fall back to viewport restore + SIGWINCH
          if (disposedRef.current || !terminalRef.current) return
          requestAnimationFrame(restoreInitialViewport)
          window.electron.terminal.resize(terminalId, terminal.cols, terminal.rows)
        })
      }

      syncFontAfterLoad()
    }, TERMINAL_INIT_DELAY)

    // ── Custom key event handler ─────────────────────────────────────────────
    const ctrlVHandler = getCtrlVHandler(terminal)

    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (shouldBypassXtermShortcut(e)) return false

      if (e.type !== 'keydown') return true

      if (e.key === 'Enter' && shouldSendEnhancedEnter()) {
        const sequence = getCsiUEnterSequence(e)
        if (sequence) {
          e.preventDefault()
          followLiveOutput()
          window.electron.terminal.write(terminalId, sequence)
          return false
        }
      }

      const ctrlVResult = ctrlVHandler(e)
      if (ctrlVResult !== undefined) return ctrlVResult

      return true
    })

    // ── Vietnamese IME NFC/NFD correction ────────────────────────────────────
    // macOS IME uses backspace mode and sends DEL count based on NFD buffer length.
    // We normalize to NFC before sending to PTY; track the length delta as "debt"
    // and swallow extra DELs from the IME.
    let imeDelDebt = 0

    terminal.onData((data) => {
      // Drop xterm focus-report events (DECSET 1004). Forwarding them causes
      // inline TUI apps (e.g. Claude Code) to re-render on every OS window
      // blur/focus, which shifts the prompt down since the redraw can't
      // reliably erase the previous frame in inline (non-alt-buffer) mode.
      if (data === '\x1b[I' || data === '\x1b[O') return
      // IME DEL-debt: swallow extra DELs that the IME emits after NFC collapse
      if (data === '\x7f' && imeDelDebt > 0) {
        imeDelDebt--
        return
      }
      followLiveOutput()

      // Normalize payloads that may carry NFD text; track debt.
      let payload = data
      if (data !== '\x7f' && data !== '\r' && data !== '\x03' && !data.includes('\r')) {
        const nfcData = data.normalize('NFC')
        const origLen = [...data].length
        const nfcLen = [...nfcData].length
        if (origLen > nfcLen) {
          imeDelDebt += origLen - nfcLen
        } else {
          imeDelDebt = 0
        }
        payload = nfcData
      }

      window.electron.terminal.write(terminalId, payload)

      // Enter or Ctrl+C clears the prompt — drop any mirrored attachments.
      if ((data === '\r' || data === '\x03') && useImageStore.getState().getImages(terminalId).length > 0) {
        useImageStore.getState().clearImages(terminalId)
      }
    })

    // ── Resize handler ───────────────────────────────────────────────────────
    // fitAddon may fire onResize many times in quick succession (rAF + settle
    // pass, plus continuous drag of the split divider). Each one sends
    // SIGWINCH to the shell, and rapid SIGWINCHes make fish redraw the prompt
    // before clearing the previous one — so duplicate prompts pile up. Coalesce
    // into a single IPC call once cols/rows settle.
    let pendingResize: { cols: number; rows: number } | null = null
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let lastSent: { cols: number; rows: number } | null = null
    const flushResize = (): void => {
      resizeTimer = null
      if (!pendingResize) return
      const { cols, rows } = pendingResize
      pendingResize = null
      if (lastSent && lastSent.cols === cols && lastSent.rows === rows) return
      lastSent = { cols, rows }
      window.electron.terminal.resize(terminalId, cols, rows)
      onResize?.(cols, rows)
    }
    terminal.onResize(({ cols, rows }) => {
      pendingResize = { cols, rows }
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(flushResize, 80)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- RefObject values are stable; listed for clarity
  }, [
    disposedRef,
    containerRef,
    terminalRef,
    fitAddonRef,
    terminalId,
    isActiveRef,
    isHiddenRef,
    scrollMachineRef,
    userViewportInteractingRef,
    viewportListenersRef,
    scrollDisposableRef,
    syncViewportState,
    clearUserViewportInteraction,
    markUserViewportInteraction,
    shouldSendEnhancedEnter,
    attachClipboardListeners,
    getCtrlVHandler,
    followLiveOutput,
    reconcileWebGL,
    syncFontAfterLoad,
    registerTerminalDebugHandle,
    onWriteParsed,
    onResize,
  ])

  return { initTerminal }
}
