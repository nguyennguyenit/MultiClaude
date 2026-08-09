// vitest.config.ts: this file runs in 'node' env (pure class, no DOM)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// This import will fail (RED) until Phase 04 creates the class.
// Tests define the behavioral contract before implementation.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - file does not exist yet
import { TerminalScrollMachine } from '../terminal-scroll-machine'

// Minimal buffer type for testing
interface MockBuffer {
  viewportY: number
  baseY: number
}

function mockBuffer(viewportY: number, baseY: number): MockBuffer {
  return { viewportY, baseY }
}

describe('TerminalScrollMachine', () => {
  let machine: InstanceType<typeof TerminalScrollMachine>
  let terminal: {
    buffer: { active: MockBuffer }
    scrollToBottom: ReturnType<typeof vi.fn>
    scrollToLine: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    machine = new TerminalScrollMachine()
    terminal = {
      buffer: { active: mockBuffer(0, 0) },
      scrollToBottom: vi.fn(),
      scrollToLine: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('starts with isAtBottom=true, pendingWriteCount=0, isWriting=false', () => {
      expect(machine.pendingWriteCount).toBe(0)
      expect(machine.isAtBottom).toBe(true)
      expect(machine.isWriting).toBe(false)
    })

    it('starts with no scroll intents', () => {
      expect(machine.hiddenViewportIntent).toBeNull()
      expect(machine.pendingUserScrollIntent).toBeNull()
      expect(machine.readingViewportIntent).toBeNull()
      expect(machine.followOutputOnNextWrite).toBe(false)
    })
  })

  describe('beforeWrite', () => {
    it('increments pendingWriteCount', () => {
      terminal.buffer.active = mockBuffer(50, 100)
      machine.beforeWrite(terminal as never)
      expect(machine.pendingWriteCount).toBe(1)
    })

    it('sets isWriting=true', () => {
      machine.beforeWrite(terminal as never)
      expect(machine.isWriting).toBe(true)
    })

    it('captures wasAtBottom=true when viewportY near baseY', () => {
      // baseY=100, viewportY=98 → near bottom (diff=2, threshold=5)
      terminal.buffer.active = mockBuffer(98, 100)
      const snapshot = machine.beforeWrite(terminal as never)
      expect(snapshot.wasAtBottom).toBe(true)
    })

    it('captures wasAtBottom=false when user scrolled significantly up', () => {
      // baseY=100, viewportY=60 → not near bottom (diff=40, threshold=5)
      terminal.buffer.active = mockBuffer(60, 100)
      const snapshot = machine.beforeWrite(terminal as never)
      expect(snapshot.wasAtBottom).toBe(false)
    })

    it('captures exact savedViewportY from buffer', () => {
      terminal.buffer.active = mockBuffer(77, 200)
      const snapshot = machine.beforeWrite(terminal as never)
      expect(snapshot.savedViewportY).toBe(77)
    })

    it('only captures snapshot on first write (pendingWriteCount was 0)', () => {
      terminal.buffer.active = mockBuffer(50, 100)
      const snapshot1 = machine.beforeWrite(terminal as never)

      // Second write while first is pending — snapshot should not be overwritten
      terminal.buffer.active = mockBuffer(20, 120)
      machine.beforeWrite(terminal as never)

      // snapshot1 should still hold first write's state
      expect(snapshot1.savedViewportY).toBe(50)
      expect(machine.pendingWriteCount).toBe(2)
    })
  })

  describe('afterWrite', () => {
    it('decrements pendingWriteCount', () => {
      terminal.buffer.active = mockBuffer(100, 100)
      const snapshot = machine.beforeWrite(terminal as never)
      machine.afterWrite(terminal as never, snapshot)
      expect(machine.pendingWriteCount).toBe(0)
    })

    it('sets isWriting=false when last write completes', () => {
      terminal.buffer.active = mockBuffer(100, 100)
      const snapshot = machine.beforeWrite(terminal as never)
      machine.afterWrite(terminal as never, snapshot)
      expect(machine.isWriting).toBe(false)
    })

    it('stays isWriting=true when more writes pending', () => {
      terminal.buffer.active = mockBuffer(100, 100)
      machine.beforeWrite(terminal as never)
      const snapshot = machine.beforeWrite(terminal as never)
      machine.afterWrite(terminal as never, snapshot)
      expect(machine.isWriting).toBe(true)
      expect(machine.pendingWriteCount).toBe(1)
    })

    it('never goes below 0 pendingWriteCount', () => {
      terminal.buffer.active = mockBuffer(100, 100)
      const snapshot = machine.beforeWrite(terminal as never)
      machine.afterWrite(terminal as never, snapshot)
      machine.afterWrite(terminal as never, snapshot)  // extra call
      expect(machine.pendingWriteCount).toBe(0)
    })

    it('does not call scrollToBottom explicitly when wasAtBottom=true (xterm auto-follows)', () => {
      // When wasAtBottom=true and no user intent, resolveViewportRestoreTarget returns null.
      // xterm auto-scrolls on write, so no explicit scrollToBottom call is needed.
      terminal.buffer.active = mockBuffer(100, 100)
      const snapshot = machine.beforeWrite(terminal as never)
      machine.afterWrite(terminal as never, snapshot)
      expect(terminal.scrollToBottom).not.toHaveBeenCalled()
      expect(terminal.scrollToLine).not.toHaveBeenCalled()
    })

    it('calls scrollToLine to restore position when user scrolled up', () => {
      // User is reading scrollback at line 50
      terminal.buffer.active = mockBuffer(50, 100)
      const snapshot = machine.beforeWrite(terminal as never)

      // Set user scroll intent — user wants to stay at line 50
      machine.pendingUserScrollIntent = { viewportY: 50, stickToBottom: false }

      machine.afterWrite(terminal as never, snapshot)
      expect(terminal.scrollToLine).toHaveBeenCalledWith(50)
      expect(terminal.scrollToBottom).not.toHaveBeenCalled()
    })

    it('scrolls to bottom when user intent is stickToBottom=true', () => {
      terminal.buffer.active = mockBuffer(50, 100)
      const snapshot = machine.beforeWrite(terminal as never)

      machine.pendingUserScrollIntent = { viewportY: null, stickToBottom: true }

      machine.afterWrite(terminal as never, snapshot)
      expect(terminal.scrollToBottom).toHaveBeenCalled()
    })

    it('follows output immediately when followOutputOnNextWrite is set', () => {
      terminal.buffer.active = mockBuffer(50, 100)
      machine.followOutputOnNextWrite = true
      const snapshot = machine.beforeWrite(terminal as never)
      machine.afterWrite(terminal as never, snapshot)
      expect(terminal.scrollToBottom).toHaveBeenCalled()
      expect(machine.followOutputOnNextWrite).toBe(false)
    })

    it('does not call onStateChange when wasAtBottom (no change to track)', () => {
      // When wasAtBottom=true, xterm auto-follows. No explicit scroll, so no state change event.
      terminal.buffer.active = mockBuffer(100, 100)
      const onStateChange = vi.fn()
      const snapshot = machine.beforeWrite(terminal as never)
      machine.afterWrite(terminal as never, snapshot, onStateChange)
      expect(onStateChange).not.toHaveBeenCalled()
    })

    it('clears pendingUserScrollIntent after last write', () => {
      terminal.buffer.active = mockBuffer(50, 100)
      const snapshot = machine.beforeWrite(terminal as never)
      machine.pendingUserScrollIntent = { viewportY: 50, stickToBottom: false }
      machine.afterWrite(terminal as never, snapshot)
      expect(machine.pendingUserScrollIntent).toBeNull()
    })
  })

  describe('onScroll', () => {
    it('sets isAtBottom=true when viewportY near baseY', () => {
      machine.isAtBottom = false
      machine.onScroll(98, 100, { isHidden: false, source: 'programmatic' })
      expect(machine.isAtBottom).toBe(true)
    })

    it('sets isAtBottom=false when user scrolled up', () => {
      machine.onScroll(50, 100, { isHidden: false, source: 'wheel' })
      expect(machine.isAtBottom).toBe(false)
    })

    it('stores hiddenViewportIntent when terminal is hidden', () => {
      machine.onScroll(50, 100, { isHidden: true, source: 'programmatic' })
      expect(machine.hiddenViewportIntent).not.toBeNull()
      expect(machine.hiddenViewportIntent?.viewportY).toBe(50)
    })

    it('does not create user scroll intent during programmatic scrolls (isWriting guard)', () => {
      machine.isWriting = true
      machine.onScroll(50, 100, { isHidden: false, source: 'wheel' })
      expect(machine.pendingUserScrollIntent).toBeNull()
    })

    it('creates user scroll intent on wheel scroll when not writing', () => {
      machine.isWriting = false
      machine.onScroll(50, 100, { isHidden: false, source: 'wheel' })
      expect(machine.pendingUserScrollIntent).not.toBeNull()
      expect(machine.pendingUserScrollIntent?.viewportY).toBe(50)
      expect(machine.pendingUserScrollIntent?.stickToBottom).toBe(false)
    })

    it('creates stickToBottom intent when user scrolls to bottom', () => {
      machine.isWriting = false
      machine.onScroll(100, 100, { isHidden: false, source: 'wheel' })
      expect(machine.pendingUserScrollIntent?.stickToBottom).toBe(true)
    })

    it('clears user scroll intent when scrolled to bottom', () => {
      machine.pendingUserScrollIntent = { viewportY: 50, stickToBottom: false }
      machine.isWriting = false
      // Scroll to bottom (near baseY)
      machine.onScroll(100, 100, { isHidden: false, source: 'wheel' })
      // stickToBottom=true means the intent itself is set, but viewportY is null
      expect(machine.pendingUserScrollIntent?.stickToBottom).toBe(true)
    })
  })

  describe('consumeHiddenIntent', () => {
    it('returns and clears hiddenViewportIntent', () => {
      machine.hiddenViewportIntent = { viewportY: 42, stickToBottom: false }
      const intent = machine.consumeHiddenIntent()
      expect(intent?.viewportY).toBe(42)
      expect(machine.hiddenViewportIntent).toBeNull()
    })

    it('returns null when no hidden intent stored', () => {
      expect(machine.consumeHiddenIntent()).toBeNull()
    })
  })

  describe('reset', () => {
    it('resets all state to defaults', () => {
      machine.pendingWriteCount = 3
      machine.isAtBottom = false
      machine.isWriting = true
      machine.hiddenViewportIntent = { viewportY: 42, stickToBottom: false }
      machine.pendingUserScrollIntent = { viewportY: 10, stickToBottom: false }
      machine.readingViewportIntent = { viewportY: 10, stickToBottom: false }
      machine.userScrollDirection = 'up'
      machine.followOutputOnNextWrite = true

      machine.reset()

      expect(machine.pendingWriteCount).toBe(0)
      expect(machine.isAtBottom).toBe(true)
      expect(machine.isWriting).toBe(false)
      expect(machine.hiddenViewportIntent).toBeNull()
      expect(machine.pendingUserScrollIntent).toBeNull()
      expect(machine.readingViewportIntent).toBeNull()
      expect(machine.userScrollDirection).toBeNull()
      expect(machine.followOutputOnNextWrite).toBe(false)
    })
  })
})
