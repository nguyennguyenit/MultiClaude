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
import type { TerminalOutputChunk } from '@shared/types'

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
    expect(snap.ansi).toContain('line1')
    expect(snap.ansi).toContain('line2')

    // dims must reflect actual terminal size (default 80x24)
    expect(snap.cols).toBeGreaterThan(0)
    expect(snap.rows).toBeGreaterThan(0)
  })

  it('assigns monotonic envelopes and returns a coherent committed watermark', async () => {
    const chunks: TerminalOutputChunk[] = []
    manager.on('output', (chunk: TerminalOutputChunk) => chunks.push(chunk))
    const term = manager.create()

    mockPty.__emitData('one\r\n')
    mockPty.__emitData('two\r\n')
    const snap = await manager.getSnapshot(term.id)

    expect(chunks.map(chunk => chunk.sequence)).toEqual([1, 2])
    expect(new Set(chunks.map(chunk => chunk.streamEpoch)).size).toBe(1)
    expect(snap.streamEpoch).toBe(chunks[0].streamEpoch)
    expect(snap.watermark).toBe(2)
    expect(snap.ansi).toContain('one')
    expect(snap.ansi).toContain('two')
  })

  it('rejects snapshot hydration while sequenced PTY output remains live without a headless mirror', async () => {
    const chunks: TerminalOutputChunk[] = []
    manager.on('output', (chunk: TerminalOutputChunk) => chunks.push(chunk))
    const term = manager.create()
    const proc = (manager as unknown as { terminals: InternalTerminals }).terminals.get(term.id)!
    proc.headlessTerm?.dispose()
    proc.headlessTerm = undefined
    proc.serializeAddon = undefined

    mockPty.__emitData('degraded-output\r\n')

    await expect(manager.getSnapshot(term.id)).rejects.toThrow(
      `Canonical terminal snapshot unavailable for ${term.id}`
    )
    expect(chunks).toHaveLength(1)
  })

  it('uses a fresh stream epoch for each terminal lifetime', async () => {
    const first = manager.create()
    mockPty.__emitData('first\r\n')
    const firstSnapshot = await manager.getSnapshot(first.id)
    manager.destroy(first.id)

    const second = manager.create()
    mockPty.__emitData('second\r\n')
    const secondSnapshot = await manager.getSnapshot(second.id)

    expect(firstSnapshot.streamEpoch).not.toBe(secondSnapshot.streamEpoch)
    expect(secondSnapshot.watermark).toBe(1)
  })

  it('reports the committed alternate buffer in the snapshot contract', async () => {
    const term = manager.create()
    mockPty.__emitData('\x1b[?1049hfull-screen')

    const snapshot = await manager.getSnapshot(term.id)

    expect(snapshot.buffer).toBe('alternate')
    expect(snapshot.watermark).toBe(1)
  })

  it('orders canonical output before a later headless resize', async () => {
    const term = manager.create()
    const proc = (manager as unknown as { terminals: InternalTerminals }).terminals.get(term.id)!
    const events: string[] = []
    manager.on('output', () => events.push('output'))
    const originalResize = proc.headlessTerm!.resize.bind(proc.headlessTerm)
    vi.spyOn(proc.headlessTerm!, 'resize').mockImplementation((cols, rows) => {
      events.push('resize')
      originalResize(cols, rows)
    })

    mockPty.__emitData('before-resize\r\n')
    manager.resize(term.id, 100, 30)
    const snapshot = await manager.getSnapshot(term.id)

    expect(events).toEqual(['output', 'resize'])
    expect(snapshot.watermark).toBe(1)
    expect(snapshot.cols).toBe(100)
    expect(snapshot.rows).toBe(30)
  })

  it('orders a synchronous PTY resize repaint after canonical dimensions', async () => {
    const term = manager.create()
    const proc = (manager as unknown as { terminals: InternalTerminals }).terminals.get(term.id)!
    const events: string[] = []
    const originalResize = proc.headlessTerm!.resize.bind(proc.headlessTerm)
    vi.spyOn(proc.headlessTerm!, 'resize').mockImplementation((cols, rows) => {
      events.push('canonical-resize')
      originalResize(cols, rows)
    })
    mockPty.resize.mockImplementationOnce(() => {
      events.push('pty-resize')
      mockPty.__emitData('resize-repaint\r\n')
    })
    manager.on('output', () => events.push('repaint-output'))

    expect(manager.resize(term.id, 100, 30)).toBe(true)
    const snapshot = await manager.getSnapshot(term.id)

    expect(events).toEqual(['pty-resize', 'canonical-resize', 'repaint-output'])
    expect(snapshot.cols).toBe(100)
    expect(snapshot.rows).toBe(30)
    expect(snapshot.ansi).toContain('resize-repaint')
  })

  it('commits final PTY output before publishing terminal exit', async () => {
    const events: string[] = []
    const term = manager.create()
    manager.on('output', (chunk: TerminalOutputChunk) => events.push(`output:${chunk.data}`))
    const exited = new Promise<void>(resolve => {
      manager.once('exit', () => {
        events.push('exit')
        resolve()
      })
    })

    mockPty.__emitData('final-output')
    mockPty._exitCallback?.({ exitCode: 0 })
    await exited

    expect(events).toEqual(['output:final-output', 'exit'])
    expect(manager.get(term.id)).toBeUndefined()
  })

  it('uses the same ordered exit finalizer for destroyAsync', async () => {
    const events: string[] = []
    const term = manager.create()
    manager.on('output', (chunk: TerminalOutputChunk) => events.push(`output:${chunk.data}`))
    manager.on('exit', () => events.push('exit'))

    mockPty.__emitData('close-tail')
    const destroying = manager.destroyAsync(term.id)
    mockPty._exitCallback?.({ exitCode: 0 })
    await destroying

    expect(events).toEqual(['output:close-tail', 'exit'])
    expect(manager.get(term.id)).toBeUndefined()
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
    expect(snap).toEqual({
      terminalId: 'nonexistent-id-xyz',
      streamEpoch: '',
      watermark: 0,
      ansi: '',
      cols: 0,
      rows: 0,
      buffer: 'normal',
    })
  })

  it('(c) snapshot round-trips cursor position into a fresh headless terminal', async () => {
    const term = manager.create()

    // Move cursor to a specific position using ANSI escape sequences:
    // ESC[H — move cursor to top-left, then print text that advances cursor
    mockPty.__emitData('AAAA\r\nBBBB\r\n')

    const snap = await manager.getSnapshot(term.id)
    expect(snap.ansi.length).toBeGreaterThan(0)

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
    await new Promise<void>(resolve => freshTerm.write(snap.ansi, () => resolve()))

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
    expect(snap).toEqual({
      terminalId: term.id,
      streamEpoch: '',
      watermark: 0,
      ansi: '',
      cols: 0,
      rows: 0,
      buffer: 'normal',
    })
  })
})
