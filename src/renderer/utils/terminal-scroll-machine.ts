import type { Terminal as XTerm } from '@xterm/xterm'
import {
  createUserScrollIntent,
  isViewportNearBottom,
  resolveViewportRestoreTarget,
  TERMINAL_SCROLL_THRESHOLD,
  type UserScrollIntent,
} from './terminal-scroll-utils'

export interface PendingWriteSnapshot {
  wasAtBottom: boolean
  savedViewportY: number
}

export type ScrollStateCallback = (isAtBottom: boolean) => void

/**
 * Pure state machine for terminal scroll position management.
 *
 * Encapsulates the 8 scroll-related refs from use-terminal.ts:
 * pendingWriteCountRef, isAtBottomRef, isWritingRef, hiddenViewportIntentRef,
 * pendingUserScrollIntentRef, followOutputOnNextWriteRef, pendingWriteViewportSnapshotRef, savedViewportYRef
 *
 * Zero React dependencies — fully unit-testable in node env.
 */
export class TerminalScrollMachine {
  pendingWriteCount = 0
  isAtBottom = true
  isWriting = false
  hiddenViewportIntent: UserScrollIntent | null = null
  pendingUserScrollIntent: UserScrollIntent | null = null
  followOutputOnNextWrite = false
  pendingWriteSnapshot: PendingWriteSnapshot | null = null
  /** Last known viewport Y for project-switch scroll restore. Updated by syncViewportState. */
  savedViewportY: number | null = null

  /**
   * Call before terminal.write() to capture pre-write viewport state.
   * Only captures snapshot on the first concurrent write (pendingWriteCount was 0).
   */
  beforeWrite(terminal: Pick<XTerm, 'buffer'>): PendingWriteSnapshot {
    const { viewportY, baseY } = terminal.buffer.active

    // Only capture snapshot before the first write in a concurrent batch
    if (this.pendingWriteCount === 0) {
      const wasAtBottom = isViewportNearBottom(baseY, viewportY, TERMINAL_SCROLL_THRESHOLD)
      this.pendingWriteSnapshot = { wasAtBottom, savedViewportY: viewportY }
    }

    this.pendingWriteCount++
    this.isWriting = true

    return this.pendingWriteSnapshot!
  }

  /**
   * Call in terminal.write() callback — after data is parsed.
   * Restores viewport position based on intent and scroll state.
   */
  afterWrite(
    terminal: Pick<XTerm, 'buffer' | 'scrollToBottom' | 'scrollToLine'>,
    snapshot: PendingWriteSnapshot,
    onStateChange?: ScrollStateCallback
  ): void {
    this.pendingWriteCount = Math.max(0, this.pendingWriteCount - 1)
    const isLastWrite = this.pendingWriteCount === 0
    this.isWriting = !isLastWrite

    if (!isLastWrite) {
      // More writes pending — defer scroll restoration
      return
    }

    const snapshot_ = this.pendingWriteSnapshot ?? snapshot
    this.pendingWriteSnapshot = null

    if (this.followOutputOnNextWrite) {
      this.followOutputOnNextWrite = false
      terminal.scrollToBottom()
      if (!this.isAtBottom) {
        this.isAtBottom = true
        onStateChange?.(true)
      } else {
        onStateChange?.(true)
      }
      this.pendingUserScrollIntent = null
      return
    }

    const currentBaseY = terminal.buffer.active.baseY

    const restoreTarget = resolveViewportRestoreTarget({
      forceStickToBottom: false,
      wasAtBottom: snapshot_.wasAtBottom,
      savedViewportY: snapshot_.savedViewportY,
      currentBaseY,
      pendingUserScrollIntent: this.pendingUserScrollIntent,
    })

    this.pendingUserScrollIntent = null

    if (restoreTarget === 'bottom') {
      terminal.scrollToBottom()
      if (!this.isAtBottom) {
        this.isAtBottom = true
        onStateChange?.(true)
      } else {
        onStateChange?.(true)
      }
    } else if (typeof restoreTarget === 'number' && restoreTarget >= 0) {
      terminal.scrollToLine(restoreTarget)
    }
    // restoreTarget === null: no action, user scroll intent was to stay where they are
  }

  /**
   * Call from terminal.onScroll handler or viewport scroll events.
   * Updates isAtBottom and captures user scroll intent when appropriate.
   */
  onScroll(
    viewportY: number,
    baseY: number,
    options: { isHidden: boolean; source: 'wheel' | 'drag' | 'programmatic' }
  ): void {
    const atBottom = isViewportNearBottom(baseY, viewportY, TERMINAL_SCROLL_THRESHOLD)

    if (options.isHidden) {
      this.hiddenViewportIntent = { viewportY, stickToBottom: atBottom }
      return
    }

    if (!this.isWriting && options.source !== 'programmatic') {
      this.pendingUserScrollIntent = createUserScrollIntent(baseY, viewportY, TERMINAL_SCROLL_THRESHOLD)
    }

    this.isAtBottom = atBottom
  }

  /**
   * Restore hidden viewport intent on terminal show.
   * Returns stored intent and clears it.
   */
  consumeHiddenIntent(): UserScrollIntent | null {
    const intent = this.hiddenViewportIntent
    this.hiddenViewportIntent = null
    return intent
  }

  /** Reset all state to defaults (e.g., on terminal unmount). */
  reset(): void {
    this.pendingWriteCount = 0
    this.isAtBottom = true
    this.isWriting = false
    this.hiddenViewportIntent = null
    this.pendingUserScrollIntent = null
    this.followOutputOnNextWrite = false
    this.pendingWriteSnapshot = null
    this.savedViewportY = null
  }
}
