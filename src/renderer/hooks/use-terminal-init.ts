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
  TERMINAL_SCROLL_OPTIONS,
  TERMINAL_SCROLL_THRESHOLD,
  withInstantTerminalScroll,
} from '../utils/terminal-scroll-utils'
import { pauseAndBuffer, resumeAndFlush, resumeFromSnapshot } from '../utils/terminal-output-dispatcher'
import { useSettingsStore, useToastStore, useImageStore } from '../stores'
import { getTerminalFontFamilyById, isAllowedExternalUrl, SCROLLBACK_DEFAULT, SCROLLBACK_MIN, SCROLLBACK_MAX } from '@shared/constants'
import { shouldBypassXtermShortcut } from '../utils'
import { getCsiUEnterSequence } from '../utils/keyboard-enhancement-utils'
import { createTerminalDraftUndo } from '../utils/terminal-draft-undo'
import { isTerminalProtocolResponse } from '../utils/terminal-input-utils'
import { acquireSnapshotReplayLock } from './use-terminal-webgl'
import { getCurrentTerminalTheme } from './use-terminal-font-theme'
import { XtermSurface } from '../terminal/xterm-surface'
import type { TerminalSurface } from '../terminal/terminal-surface'

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
  capture?: boolean
}

interface UseTerminalInitParams {
  terminalRef: RefObject<XTerm | null>
  surfaceRef: RefObject<TerminalSurface | null>
  fitAddonRef: RefObject<FitAddon | null>
  disposedRef: RefObject<boolean>
  containerRef: RefObject<HTMLDivElement | null>
  terminalId: string
  sessionToken: symbol
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
  markUserViewportInteraction: (durationMs: number, direction?: 'up' | 'down') => void
  shouldSendEnhancedEnter: () => boolean
  attachClipboardListeners: (terminal: XTerm, onTextWrite?: (payload: string) => void) => void
  getCtrlVHandler: (terminal: XTerm, onTextWrite?: (payload: string) => void) => (e: KeyboardEvent) => boolean | undefined
  followLiveOutput: () => void
  reconcileWebGL: () => void
  syncFontAfterLoad: () => void
  registerTerminalDebugHandle: () => void
  onResize?: (cols: number, rows: number) => void
}

interface UseTerminalInitResult {
  initTerminal: () => void
}

export function useTerminalInit(params: UseTerminalInitParams): UseTerminalInitResult {
  const {
    terminalRef,
    surfaceRef,
    fitAddonRef,
    disposedRef,
    containerRef,
    terminalId,
    sessionToken,
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

    // Pause live output dispatch until the snapshot is painted into xterm.
    // Without this, live SIGWINCH-redraw bytes get written to xterm BEFORE the
    // snapshot (which reflects the post-redraw final buffer). The snapshot is
    // then overlaid on top of the live-rendered content, producing a visible
    // "jump" as cursor moves / lines are cleared / prompt reprints. Buffering
    // the live chunks until after snapshot write guarantees a single clean
    // paint — any post-snapshot bytes are flushed via resumeAndFlush() below.
    pauseAndBuffer(terminalId, sessionToken)

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
      ...TERMINAL_SCROLL_OPTIONS,
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

    const surface = new XtermSurface(terminal)
    surface.mount(container)
    surfaceRef.current = surface

    // Sync fit + PTY resize BEFORE any shell output is written. Moving this out
    // of the deferred setTimeout eliminates the new-pane jump: without it, the
    // shell prints its first prompt at xterm's default 80×24, then we fit +
    // SIGWINCH 50ms later and the shell redraws the prompt at the real size
    // (visible 1–2 line dip). Doing it synchronously means the SIGWINCH fires
    // while the shell is still spawning, so the first prompt is rendered once
    // at the final cols/rows. Snapshot fetch below then reflects post-SIGWINCH
    // state, avoiding a second redraw cycle when we paint into xterm.
    try {
      fitAddon.fit()
      window.electron.terminal.resize(terminalId, terminal.cols, terminal.rows)
    } catch {
      // Container briefly 0×0 — deferred setTimeout path will retry via fitAddon.fit()
    }

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
    let reconcilingReadingViewport = false
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
        const nextIntent = createUserScrollIntent(
          buffer.baseY,
          buffer.viewportY,
          TERMINAL_SCROLL_THRESHOLD
        )
        const existingReadingIntent = scrollMachine.readingViewportIntent
        const preserveUpwardReadingIntent = atBottom
          && scrollMachine.userScrollDirection === 'up'
          && existingReadingIntent?.stickToBottom === false
        if (
          preserveUpwardReadingIntent
          && existingReadingIntent
          && existingReadingIntent.viewportY !== null
        ) {
          const targetViewportY = existingReadingIntent.viewportY
          reconcilingReadingViewport = true
          withInstantTerminalScroll(terminal, () => {
            terminal.scrollToLine(targetViewportY)
          })
          reconcilingReadingViewport = false
          syncViewportState(terminal.buffer.active, hiddenViewportIntent)
          return
        } else {
          scrollMachine.followOutputOnNextWrite = atBottom
          scrollMachine.readingViewportIntent = nextIntent
        }
      }

      if (scrollMachine.pendingWriteCount > 0 && !captureUserIntent) return

      if (scrollMachine.pendingWriteCount > 0 && captureUserIntent) {
        scrollMachine.pendingUserScrollIntent = scrollMachine.readingViewportIntent
      }

      const readingIntent = scrollMachine.readingViewportIntent
      if (
        !captureUserIntent
        && !reconcilingReadingViewport
        && readingIntent?.stickToBottom === false
        && readingIntent.viewportY !== null
        && buffer.viewportY !== readingIntent.viewportY
      ) {
        const targetViewportY = readingIntent.viewportY
        reconcilingReadingViewport = true
        withInstantTerminalScroll(terminal, () => {
          terminal.scrollToLine(targetViewportY)
        })
        reconcilingReadingViewport = false
        syncViewportState(terminal.buffer.active, hiddenViewportIntent)
        return
      }

      scrollMachine.isAtBottom = atBottom
      syncViewportState(buffer, hiddenViewportIntent)
    }

    scrollDisposableRef.current = terminal.onScroll(() => {
      syncScrollPosition(userViewportInteractingRef.current)
    })
    const viewportElement = (
      terminal.element?.querySelector('.xterm-scrollable-element')
      ?? terminal.element?.querySelector('.xterm-viewport')
    ) as HTMLElement | null
    if (viewportElement) {
      const viewportListeners: ViewportEventListener[] = []
      const addViewportListener = (
        target: EventTarget,
        type: string,
        handler: EventListener,
        capture = false
      ) => {
        target.addEventListener(type, handler, capture)
        viewportListeners.push({ target, type, handler, capture })
      }

      addViewportListener(viewportElement, 'scroll', () => syncScrollPosition(userViewportInteractingRef.current))
      addViewportListener(viewportElement, 'wheel', (event) => {
        if (!(event instanceof WheelEvent)) return
        markUserViewportInteraction(
          USER_SCROLL_WHEEL_GRACE,
          event.deltaY > 0 ? 'down' : 'up'
        )
      })
      addViewportListener(viewportElement, 'pointerdown', (event) => {
        if (!(event instanceof PointerEvent)) return
        if (!isPointerOnViewportScrollbar({
          clientX: event.clientX,
          viewportClientWidth: viewportElement.clientWidth,
          viewportOffsetWidth: viewportElement.offsetWidth,
          viewportRight: viewportElement.getBoundingClientRect().right,
          eventPath: event.composedPath()
        })) return

        markUserViewportInteraction(USER_SCROLL_DRAG_GRACE)
      })
      addViewportListener(window, 'pointerup', clearUserViewportInteraction)
      addViewportListener(window, 'pointercancel', clearUserViewportInteraction)
      addViewportListener(viewportElement, 'touchstart', () => markUserViewportInteraction(USER_SCROLL_DRAG_GRACE))
      addViewportListener(viewportElement, 'touchend', clearUserViewportInteraction)
      addViewportListener(viewportElement, 'touchcancel', clearUserViewportInteraction)
      if (terminal.element) {
        addViewportListener(terminal.element, 'keydown', (event) => {
          if (!(event instanceof KeyboardEvent)) return
          if (event.shiftKey && (event.key === 'PageUp' || event.key === 'PageDown')) {
            markUserViewportInteraction(
              USER_SCROLL_WHEEL_GRACE,
              event.key === 'PageUp' ? 'up' : 'down'
            )
          }
        }, true)
      }

      viewportListenersRef.current = viewportListeners
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    registerTerminalDebugHandle()

    const draftUndo = createTerminalDraftUndo()
    const recordPastedText = (payload: string) => {
      draftUndo.recordInput(payload, { grouped: true })
    }

    // ── Clipboard listeners ──────────────────────────────────────────────────
    attachClipboardListeners(terminal, recordPastedText)

    // ── Deferred initialisation (WebGL, fit, restore) ────────────────────────
    setTimeout(() => {
      if (disposedRef.current || terminalRef.current !== terminal) return

      // Conditionally load WebGL — delegated to reconcileWebGL which handles
      // shouldUseWebGL(), addon construction, and context-loss listener setup
      reconcileWebGL()

      try {
        fitAddon.fit()
      } catch {
        // Ignore fit errors during early init
      }

      const restoreInitialViewport = () => {
        if (disposedRef.current || terminalRef.current !== terminal) return
        if (initialViewportYRef.current !== null && initialViewportYRef.current >= 0) {
          const targetViewportY = initialViewportYRef.current
          withInstantTerminalScroll(terminal, () => {
            terminal.scrollToLine(targetViewportY)
          })
        }
        scrollMachineRef.current.savedViewportY = terminal.buffer.active.viewportY
        syncScrollPosition(false)
      }

      // Resume live output AFTER snapshot has been painted. Buffered chunks
      // received during init (most notably the shell's SIGWINCH redraw bytes
      // emitted in response to the sync resize IPC above) are flushed in
      // arrival order, on top of the snapshot. Because the snapshot already
      // reflects the post-SIGWINCH headless state, the flush is typically a
      // no-op or a small trailing delta — not a full replay.
      const finishInit = () => {
        if (disposedRef.current || terminalRef.current !== terminal) return
        resumeAndFlush(terminalId, sessionToken)
      }

      const hydrateFromCanonicalSnapshot = async () => {
        const releaseLock = await acquireSnapshotReplayLock(terminalId, sessionToken, true)
        if (!releaseLock) return
        try {
          const snap = await window.electron.terminal.getSnapshot(terminalId)
          if (disposedRef.current || terminalRef.current !== terminal) return
          const hydrationData = snap.ansi || initialOutputRef.current || ''
          if (hydrationData) {
            await (surface.write(hydrationData)
              ?? new Promise<void>(resolve => terminal.write(hydrationData, resolve)))
          }
          if (disposedRef.current || terminalRef.current !== terminal) return
          requestAnimationFrame(restoreInitialViewport)
          resumeFromSnapshot(snap, sessionToken)
        } catch {
          if (disposedRef.current || terminalRef.current !== terminal) return
          const fallback = initialOutputRef.current
          if (fallback) {
            await (surface.write(fallback)
              ?? new Promise<void>(resolve => terminal.write(fallback, resolve)))
          }
          if (disposedRef.current || terminalRef.current !== terminal) return
          requestAnimationFrame(restoreInitialViewport)
          finishInit()
        } finally {
          releaseLock()
        }
      }
      void hydrateFromCanonicalSnapshot()

      syncFontAfterLoad()
    }, TERMINAL_INIT_DELAY)

    // ── Custom key event handler ─────────────────────────────────────────────
    const ctrlVHandler = getCtrlVHandler(terminal, recordPastedText)

    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (shouldBypassXtermShortcut(e)) return false

      if (e.type !== 'keydown') return true

      const activeBuffer = terminal.buffer.active as XTerm['buffer']['active'] & { type?: string }
      if (
        activeBuffer.type !== 'alternate' &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'z'
      ) {
        const undo = draftUndo.undo()
        if (!undo) return true
        e.preventDefault()
        followLiveOutput()
        window.electron.terminal.write(terminalId, undo.sequence)
        return false
      }

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

    surface.onComposition((active) => {
      if (active) imeDelDebt = 0
    })
    surface.onInput((data) => {
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
      // Protocol replies are generated by xterm itself in response to PTY
      // queries. Forward them, but do not treat them as user input:
      // doing so would yank a user reading scrollback back to live output.
      const isProtocolResponse = isTerminalProtocolResponse(data)
      if (!isProtocolResponse) followLiveOutput()

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
      if (!isProtocolResponse) draftUndo.recordTerminalData(payload)

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
    surface.onResize((cols, rows) => {
      pendingResize = { cols, rows }
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(flushResize, 80)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- RefObject values are stable; listed for clarity
  }, [
    disposedRef,
    containerRef,
    terminalRef,
    surfaceRef,
    fitAddonRef,
    terminalId,
    sessionToken,
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
    onResize,
  ])

  return { initTerminal }
}
