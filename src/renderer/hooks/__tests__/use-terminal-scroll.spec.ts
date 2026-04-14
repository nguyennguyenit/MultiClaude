// vitest.config.ts: this file runs in 'jsdom' env
// Characterization tests for useTerminalScroll sub-hook (to be extracted in Phase 05)
// These tests will FAIL (RED) until Phase 05 creates use-terminal-scroll.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@xterm/xterm')

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - file does not exist yet (Phase 05)
import { useTerminalScroll } from '../../hooks/use-terminal-scroll'
import { mockTerminalInstance, triggerScroll } from '../../__mocks__/@xterm/xterm'

describe('useTerminalScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('placeholder — imports will fail until Phase 05 creates use-terminal-scroll.ts', () => {
    // This is a placeholder test that always passes.
    // Real tests are marked as .todo below.
    expect(true).toBe(true)
  })

  it.todo('follows live output when at bottom')
  it.todo('stops following when user scrolls up')
  it.todo('resumes following when user scrolls back to bottom')
  it.todo('preserves reading position during streaming (pending write guard)')
  it.todo('handles rapid writes without scroll jumping (write guard pattern)')
  it.todo('restores hidden viewport intent on show')
})

// Keep these referenced to prevent unused import errors after Phase 05
void useTerminalScroll
void mockTerminalInstance
void triggerScroll
void renderHook
void act
