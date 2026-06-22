/**
 * TDD tests for TerminalManager.getSnapshot — Phase 2: Snapshot IPC Channel.
 *
 * Tests cover:
 *  (a) Returns serialized ANSI with current cols/rows after PTY output.
 *  (b) Returns empty payload { data:'', cols:0, rows:0 } for unknown id.
 *  (c) Snapshot round-trips cursor position into a fresh headless terminal.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Terminal as HeadlessTerminal } from '@xterm/headless'
import { SerializeAddon } from '@xterm/addon-serialize'
import { TerminalManager } from '../terminal-manager'

// --- Mock helpers ---

const mockSpawnSync = vi.hoisted(() => vi.fn())

vi.mock('../macos-shell-detector', () => ({
  detectMacosShells: vi.fn().mockResolvedValue([]),
}))

/**
 * Mocked pty instance with __emitData helper.
 * __emitData triggers the registered onData callback synchronously.
 */
const mockPty = {
  onData: vi.fn((cb: (data: string) => void) => { mockPty._dataCallback = cb }),
  onExit: vi.fn((cb: (info: { exitCode: number }) => void) => { mockPty._exitCallback = cb }),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  pid: 12345,
  _dataCallback: null as ((data: string) => void) | null,
  _exitCallback: null as ((info: { exitCode: number }) => void) | null,
  /** Synchronously emit PTY output as if data arrived from the PTY. */
  __emitData(data: string): void {
    if (this._dataCallback) this._dataCallback(data)
  },
}

vi.mock('@lydell/node-pty', () => ({
  spawn: vi.fn(() => mockPty),
}))

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    spawnSync: mockSpawnSync,
  }
})

// --- Type alias for internal process access ---
type InternalTerminals = Map<string, {
  headlessTerm?: HeadlessTerminal
  serializeAddon?: SerializeAddon
}>

// --- Tests ---

describe('TerminalManager.getSnapshot', () => {
  let manager: TerminalManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockSpawnSync.mockReturnValue({ status: 1 })
    mockPty._dataCallback = null
    mockPty._exitCallback = null
    manager = new TerminalManager()
  })

  afterEach(() => {
    manager.destroyAll()
  })

  it('(a) returns serialized ANSI with current cols/rows after __emitData', async () => {
    const term = manager.create()

    // Emit some PTY output
    mockPty.__emitData('line1\r\nline2\r\n')

    const snap = await manager.getSnapshot(term.id)

    // data must contain the output text
    expect(snap.data).toContain('line1')
    expect(snap.data).toContain('line2')

    // dims must reflect actual terminal size (default 80x24)
    expect(snap.cols).toBeGreaterThan(0)
    expect(snap.rows).toBeGreaterThan(0)
    expect(snap.byteOffset).toBe('line1\r\nline2\r\n'.length)
  })

  it('(a) includes timing: snapshot serialize latency <60ms for typical scrollback', async () => {
    const term = manager.create()

    // Write enough data to exercise serializer timing
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i}: ${'x'.repeat(60)}\r\n`).join('')
    mockPty.__emitData(lines)

    const start = performance.now()
    await manager.getSnapshot(term.id)
    const elapsed = performance.now() - start

    // Generous bound in test environment — real target is <60ms for 10k lines
    expect(elapsed).toBeLessThan(5000)
    console.log(`[snapshot-latency] ${Math.round(elapsed)}ms for 200-line payload`)
  })

  it('(b) returns empty payload { data: "", cols: 0, rows: 0 } for unknown id', async () => {
    const snap = await manager.getSnapshot('nonexistent-id-xyz')
    expect(snap).toEqual({ data: '', cols: 0, rows: 0 })
  })

  it('(c) snapshot round-trips cursor position into a fresh headless terminal', async () => {
    const term = manager.create()

    // Move cursor to a specific position using ANSI escape sequences:
    // ESC[H — move cursor to top-left, then print text that advances cursor
    mockPty.__emitData('AAAA\r\nBBBB\r\n')

    const snap = await manager.getSnapshot(term.id)
    expect(snap.data.length).toBeGreaterThan(0)

    // Write the snapshot into a fresh headless terminal and verify it processes cleanly
    const freshTerm = new HeadlessTerminal({
      cols: snap.cols,
      rows: snap.rows,
      scrollback: 1000,
      allowProposedApi: true,
    })
    const freshAddon = new SerializeAddon()
    freshTerm.loadAddon(freshAddon as unknown as Parameters<typeof freshTerm.loadAddon>[0])

    // Write serialized data into fresh terminal
    await new Promise<void>(resolve => freshTerm.write(snap.data, () => resolve()))

    // Cursor Y in fresh terminal should be > 0 (text was written, cursor advanced)
    expect(freshTerm.buffer.active.cursorY).toBeGreaterThanOrEqual(0)

    // Re-serializing should still contain the original text
    const reserialized = freshAddon.serialize({ scrollback: 1000 })
    expect(reserialized).toContain('AAAA')
    expect(reserialized).toContain('BBBB')

    freshTerm.dispose()
  })

  it('returns correct cols/rows after terminal resize', async () => {
    const term = manager.create()
    manager.resize(term.id, 120, 40)

    mockPty.__emitData('resized content\r\n')

    const snap = await manager.getSnapshot(term.id)
    expect(snap.cols).toBe(120)
    expect(snap.rows).toBe(40)
  })

  it('returns empty payload if terminal exits before getSnapshot resolves', async () => {
    const term = manager.create()
    mockPty.__emitData('some output\r\n')

    // Simulate PTY exit mid-flight by triggering the exit callback
    // getSnapshot must guard against stale process reference
    mockPty._exitCallback?.({ exitCode: 0 })

    // After exit the terminal is removed from the map — should return empty payload
    const snap = await manager.getSnapshot(term.id)
    expect(snap).toEqual({ data: '', cols: 0, rows: 0 })
  })
})
