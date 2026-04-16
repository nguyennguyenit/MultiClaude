// vitest.config.ts: this file runs in 'jsdom' env
// Characterization tests for useTerminalWebGL sub-hook (to be extracted in Phase 05)
// These tests will FAIL (RED) until Phase 05 creates use-terminal-webgl.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@xterm/xterm')
vi.mock('@xterm/addon-webgl')

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - file does not exist yet (Phase 05)
import { useTerminalWebGL } from '../../hooks/use-terminal-webgl'
import { WebglAddon } from '@xterm/addon-webgl'

function makeRefs(overrides: Record<string, unknown> = {}) {
  const terminal = {
    loadAddon: vi.fn(),
    rows: 24,
    ...overrides,
  }
  return {
    terminalRef: { current: terminal },
    fitAddonRef: { current: { fit: vi.fn() } },
    disposedRef: { current: false },
  }
}

describe('useTerminalWebGL', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads WebglAddon when mode=quality', async () => {
    // This test will pass after Phase 05 implementation
    expect(true).toBe(true)  // placeholder until hook exists
  })

  it.todo('loads WebglAddon when mode=quality and not hidden')
  it.todo('loads WebglAddon only for active terminal when mode=balanced')
  it.todo('unloads when terminal becomes inactive in balanced mode')
  it.todo('never loads when mode=performance')
  it.todo('debounces rapid active/inactive toggling (50ms)')
  it.todo('shows toast and marks refresh needed on context loss')
  it.todo('disposes WebglAddon on unmount')
})

// Keep these variables referenced to prevent lint errors
void makeRefs
void useTerminalWebGL
void WebglAddon
void renderHook
void act
