// @vitest-environment jsdom
// Characterization tests for useTerminalScroll sub-hook (to be extracted in Phase 05)
// These tests will FAIL (RED) until Phase 05 creates use-terminal-scroll.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { TerminalScrollMachine } from '../../utils/terminal-scroll-machine'

vi.mock('@xterm/xterm')

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - file does not exist yet (Phase 05)
import { useTerminalScroll } from '../../hooks/use-terminal-scroll'
import { mockTerminalInstance, triggerScroll } from '../../__mocks__/@xterm/xterm'

describe('useTerminalScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockTerminalInstance.buffer.active = { viewportY: 0, baseY: 0 }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.todo('follows live output when at bottom')
  it.todo('stops following when user scrolls up')
  it.todo('resumes following when user scrolls back to bottom')
  it.todo('handles rapid writes without scroll jumping (write guard pattern)')
  it.todo('restores hidden viewport intent on show')

  it('preserves reading position during streaming after xterm parses live output', async () => {
    const finishWrites: Array<() => void> = []
    const write = vi.fn(() => new Promise<void>((resolve) => {
      finishWrites.push(resolve)
    }))
    const scrollMachine = new TerminalScrollMachine()
    scrollMachine.readingViewportIntent = { viewportY: 80, stickToBottom: false }
    mockTerminalInstance.buffer.active = { viewportY: 80, baseY: 120 }

    const { result } = renderHook(() => useTerminalScroll({
      terminalRef: { current: mockTerminalInstance } as never,
      surfaceRef: { current: { write } } as never,
      disposedRef: { current: false },
      isHiddenRef: { current: false },
      scrollMachineRef: { current: scrollMachine },
      userViewportInteractingRef: { current: false },
      processKeyboardEnhancementOutput: data => data,
    }))

    act(() => {
      result.current.write('live output')
    })

    // xterm advances to the live cursor while parsing the chunk. The hook must
    // still restore the reading position captured before that write began.
    mockTerminalInstance.buffer.active = { viewportY: 140, baseY: 140 }
    await act(async () => {
      finishWrites.shift()?.()
      await Promise.resolve()
    })

    expect(mockTerminalInstance.scrollToLine).toHaveBeenCalledWith(80)
    expect(mockTerminalInstance.scrollToBottom).not.toHaveBeenCalled()

    // xterm can publish its transient bottom position between sequential
    // chunks. The next batch must still honor the user's reading intent.
    mockTerminalInstance.buffer.active = { viewportY: 140, baseY: 140 }
    act(() => {
      result.current.write('more live output')
    })
    mockTerminalInstance.buffer.active = { viewportY: 160, baseY: 160 }
    await act(async () => {
      finishWrites.shift()?.()
      await Promise.resolve()
    })

    expect(mockTerminalInstance.scrollToLine).toHaveBeenLastCalledWith(80)
    expect(mockTerminalInstance.scrollToLine).toHaveBeenCalledTimes(2)
  })
})

// Keep these referenced for the remaining characterization cases.
void useTerminalScroll
void mockTerminalInstance
void triggerScroll
void renderHook
void act
