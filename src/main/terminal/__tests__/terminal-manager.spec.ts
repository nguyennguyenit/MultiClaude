import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as pty from '@lydell/node-pty'
import { TerminalManager } from '../terminal-manager'
import { TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO } from '@shared/constants'

const mockSpawnSync = vi.hoisted(() => vi.fn())
const mockExistsSync = vi.hoisted(() => vi.fn())
const mockReaddirSync = vi.hoisted(() => vi.fn())

vi.mock('../macos-shell-detector', () => ({
  detectMacosShells: vi.fn().mockResolvedValue([]),
}))

// Mock node-pty
const mockPty = {
  onData: vi.fn((cb) => { mockPty._dataCallback = cb }),
  onExit: vi.fn((cb) => { mockPty._exitCallback = cb }),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  _dataCallback: null as ((data: string) => void) | null,
  _exitCallback: null as ((info: { exitCode: number }) => void) | null
}

vi.mock('@lydell/node-pty', () => ({
  spawn: vi.fn(() => mockPty)
}))

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    spawnSync: mockSpawnSync
  }
})

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync
  }
})

describe('TerminalManager', () => {
  let manager: TerminalManager

  beforeEach(() => {
    manager = new TerminalManager()
    vi.clearAllMocks()
    mockSpawnSync.mockReturnValue({ status: 1 })
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
  })

  afterEach(() => {
    manager.destroyAll()
  })

  describe('create', () => {
    it('creates terminal with generated id', () => {
      const term = manager.create()
      expect(term.id).toMatch(/^term-/)
      expect(term.title).toBe('Terminal 1')
    })

    it('creates terminal with incremented title', () => {
      manager.create()
      const term2 = manager.create()
      expect(term2.title).toBe('Terminal 2')
    })

    it('does not reuse a default title after a terminal is destroyed', () => {
      manager.create()
      const term2 = manager.create()
      const term3 = manager.create()

      manager.destroy(term2.id)

      const term4 = manager.create()
      expect(term3.title).toBe('Terminal 3')
      expect(term4.title).toBe('Terminal 4')
    })

    it('creates terminal with custom cwd', () => {
      const term = manager.create({ cwd: '/custom/path' })
      expect(term.cwd).toBe('/custom/path')
    })

    it('associates terminal with project', () => {
      const term = manager.create({ projectId: 'proj-1' })
      expect(term.projectId).toBe('proj-1')
    })

    it('initializes with isClaudeMode false', () => {
      const term = manager.create()
      expect(term.isClaudeMode).toBe(false)
    })

    it('initializes with allowTitleUpdate false', () => {
      const term = manager.create()
      expect(term.allowTitleUpdate).toBe(false)
    })

    it('emits output stream offsets for snapshot/live dedupe', () => {
      const term = manager.create()
      const outputListener = vi.fn()
      manager.on('output', outputListener)

      mockPty._dataCallback?.('hello')
      mockPty._dataCallback?.(' world')

      expect(outputListener).toHaveBeenNthCalledWith(1, {
        terminalId: term.id,
        data: 'hello',
        startOffset: 0,
        endOffset: 5,
      })
      expect(outputListener).toHaveBeenNthCalledWith(2, {
        terminalId: term.id,
        data: ' world',
        startOffset: 5,
        endOffset: 11,
      })
    })
  })

  describe('write', () => {
    it('writes data to terminal', () => {
      const term = manager.create()
      const result = manager.write(term.id, 'test')
      expect(result).toBe(true)
      expect(mockPty.write).toHaveBeenCalledWith('test')
    })

    it('marks a terminal as Claude mode when the user launches claude manually', () => {
      const term = manager.create()

      manager.write(term.id, 'claude')
      manager.write(term.id, '\r')

      expect(manager.get(term.id)?.isClaudeMode).toBe(true)
    })

    it('enables title updates and emits stateChange when claude is launched manually', () => {
      const term = manager.create()
      const stateChangeListener = vi.fn()
      manager.on('stateChange', stateChangeListener)

      manager.write(term.id, 'claude --resume session-123')
      manager.write(term.id, '\r')

      expect(manager.get(term.id)?.allowTitleUpdate).toBe(true)
      expect(stateChangeListener).toHaveBeenCalledWith({ terminalId: term.id, isClaudeMode: true })
    })

    it('stores the resumed Claude session ID when launched manually', () => {
      const term = manager.create()

      manager.write(term.id, 'claude --resume session-123')
      manager.write(term.id, '\r')

      expect(manager.get(term.id)?.claudeSessionId).toBe('session-123')
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.write('invalid', 'test')).toBe(false)
    })
  })

  describe('resize', () => {
    it('resizes terminal', () => {
      const term = manager.create()
      const result = manager.resize(term.id, 120, 40)
      expect(result).toBe(true)
      expect(mockPty.resize).toHaveBeenCalledWith(120, 40)
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.resize('invalid', 80, 24)).toBe(false)
    })
  })

  describe('resizeHeadless', () => {
    it('resizes the headless mirror without sending SIGWINCH to the PTY', () => {
      const term = manager.create()
      const result = manager.resizeHeadless(term.id, 92, 28)

      expect(result).toBe(true)
      expect(mockPty.resize).not.toHaveBeenCalledWith(92, 28)
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.resizeHeadless('invalid', 80, 24)).toBe(false)
    })
  })

  describe('destroy', () => {
    it('destroys terminal', () => {
      const term = manager.create()
      const result = manager.destroy(term.id)
      expect(result).toBe(true)
      expect(mockPty.kill).toHaveBeenCalled()
    })

    it('removes terminal from list', () => {
      const term = manager.create()
      manager.destroy(term.id)
      expect(manager.get(term.id)).toBeUndefined()
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.destroy('invalid')).toBe(false)
    })
  })

  describe('destroyAll', () => {
    it('destroys all terminals', () => {
      manager.create()
      manager.create()
      expect(manager.list()).toHaveLength(2)

      manager.destroyAll()
      expect(manager.list()).toHaveLength(0)
    })
  })

  describe('list', () => {
    it('returns empty array initially', () => {
      expect(manager.list()).toEqual([])
    })

    it('returns all terminals', () => {
      manager.create()
      manager.create()
      expect(manager.list()).toHaveLength(2)
    })
  })

  describe('get', () => {
    it('returns terminal by id', () => {
      const term = manager.create()
      const found = manager.get(term.id)
      expect(found?.id).toBe(term.id)
    })

    it('returns undefined for non-existent terminal', () => {
      expect(manager.get('invalid')).toBeUndefined()
    })
  })

  describe('invokeClaudeCode', () => {
    it('writes claude command to terminal', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id)
      expect(mockPty.write).toHaveBeenCalledWith('claude\n')
    })

    it('includes session id if provided', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id, 'session-123')
      expect(mockPty.write).toHaveBeenCalledWith('claude --resume session-123\n')
    })

    it('stores session id if provided', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id, 'session-123')
      expect(manager.get(term.id)?.claudeSessionId).toBe('session-123')
    })

    it('sets isClaudeMode to true', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id)
      const updated = manager.get(term.id)
      expect(updated?.isClaudeMode).toBe(true)
    })

    it('sets allowTitleUpdate to true', () => {
      const term = manager.create()
      manager.invokeClaudeCode(term.id)
      const updated = manager.get(term.id)
      expect(updated?.allowTitleUpdate).toBe(true)
    })

    it('returns false for non-existent terminal', () => {
      expect(manager.invokeClaudeCode('invalid')).toBe(false)
    })
  })

  describe('Windows PowerShell resolution', () => {
    it('prefers pwsh.exe when available on PATH', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      mockSpawnSync.mockImplementation((command: string, args?: string[]) => (
        command === 'where.exe' && args?.[0] === 'pwsh.exe'
          ? { status: 0 }
          : { status: 1 }
      ))

      const winManager = new TerminalManager()
      winManager.create({ shell: { type: 'powershell' } })

      expect(pty.spawn).toHaveBeenCalledWith(
        'pwsh.exe',
        ['-NoLogo'],
        expect.objectContaining({ name: 'xterm-256color' })
      )

      platformSpy.mockRestore()
    })

    it('falls back to PowerShell 7 install path when pwsh.exe is not on PATH', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      const originalProgramFiles = process.env.ProgramFiles

      process.env.ProgramFiles = 'C:\\Program Files'
      mockSpawnSync.mockReturnValue({ status: 1 })
      mockExistsSync.mockImplementation((target: string) => (
        target === 'C:\\Program Files/PowerShell' || target === 'C:\\Program Files/PowerShell/7/pwsh.exe'
      ))
      mockReaddirSync.mockReturnValue([
        {
          name: '7',
          isDirectory: () => true
        }
      ])

      const winManager = new TerminalManager()
      winManager.create({ shell: { type: 'powershell' } })

      expect(pty.spawn).toHaveBeenCalledWith(
        'C:\\Program Files/PowerShell/7/pwsh.exe',
        ['-NoLogo'],
        expect.objectContaining({ name: 'xterm-256color' })
      )

      process.env.ProgramFiles = originalProgramFiles
      platformSpy.mockRestore()
    })

    it('falls back to powershell.exe when PowerShell 7 is unavailable', () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')

      const winManager = new TerminalManager()
      winManager.create({ shell: { type: 'powershell' } })

      expect(pty.spawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoLogo'],
        expect.objectContaining({ name: 'xterm-256color' })
      )

      platformSpy.mockRestore()
    })
  })

  describe('getSessions', () => {
    it('returns session info for all terminals', () => {
      const term = manager.create({ projectId: 'proj-1' })
      const sessions = manager.getSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe(term.id)
      expect(sessions[0].projectId).toBe('proj-1')
    })

    it('trims buffered output to TRIM_TO when exceeding BUFFER_MAX', () => {
      const term = manager.create()
      const largeOutput = 'x'.repeat(TERMINAL_OUTPUT_BUFFER_MAX + 25)

      mockPty._dataCallback?.(largeOutput)

      const sessions = manager.getSessions()
      expect(sessions[0].id).toBe(term.id)
      expect(sessions[0].outputBuffer).toHaveLength(TERMINAL_OUTPUT_BUFFER_TRIM_TO)
    })

    it('can attach a Claude session ID to a live Claude terminal by cwd', () => {
      const term = manager.create({ cwd: '/workspace/app' })

      manager.write(term.id, 'claude')
      manager.write(term.id, '\r')

      expect(manager.attachClaudeSession('session-456', '/workspace/app')).toEqual({ id: term.id })
      expect(manager.get(term.id)?.claudeSessionId).toBe('session-456')
      expect(manager.findByClaudeSessionId('session-456')).toEqual({ id: term.id })
    })
  })

  describe('destroyAsync', () => {
    it('resolves after terminal exits', async () => {
      const term = manager.create()
      const promise = manager.destroyAsync(term.id)

      // Simulate exit
      mockPty._exitCallback?.({ exitCode: 0 })

      const result = await promise
      expect(result).toBe(true)
      expect(manager.get(term.id)).toBeUndefined()
    })

    it('force kills after timeout', async () => {
      vi.useFakeTimers()
      const term = manager.create()

      const promise = manager.destroyAsync(term.id)

      // Advance past timeout without exit (3000ms default)
      vi.advanceTimersByTime(3001)

      const result = await promise
      expect(result).toBe(true)
      vi.useRealTimers()
    })

    it('returns false for non-existent terminal', async () => {
      const result = await manager.destroyAsync('invalid')
      expect(result).toBe(false)
    })

    it('ignores write/resize/invokeClaudeCode once destroyAsync has started', () => {
      // Regression: async "write EOF" from node-pty stream fired after pty.kill()
      // because write()/resize() didn't check term.destroying, letting queued
      // IPC events land on a closing stream.
      const term = manager.create()
      mockPty.write.mockClear()
      mockPty.resize.mockClear()

      // Start destroy — sets destroying=true but doesn't resolve until onExit.
      void manager.destroyAsync(term.id)

      expect(manager.write(term.id, 'queued input')).toBe(false)
      expect(manager.resize(term.id, 120, 40)).toBe(false)
      expect(manager.invokeClaudeCode(term.id)).toBe(false)
      expect(mockPty.write).not.toHaveBeenCalled()
      expect(mockPty.resize).not.toHaveBeenCalled()

      // Finalize cleanup so afterEach doesn't warn.
      mockPty._exitCallback?.({ exitCode: 0 })
    })
  })

  describe('destroyAllAsync', () => {
    it('destroys all terminals', async () => {
      manager.create()
      manager.create()
      expect(manager.list()).toHaveLength(2)

      // Simulate exits for all terminals
      setTimeout(() => {
        mockPty._exitCallback?.({ exitCode: 0 })
        mockPty._exitCallback?.({ exitCode: 0 })
      }, 10)

      await manager.destroyAllAsync()
      expect(manager.list()).toHaveLength(0)
    })
  })

  describe('hasTerminals', () => {
    it('returns false when no terminals', () => {
      expect(manager.hasTerminals()).toBe(false)
    })

    it('returns true when terminals exist', () => {
      manager.create()
      expect(manager.hasTerminals()).toBe(true)
    })
  })

  describe('getShellCommand on macOS/Linux', () => {
    let platformSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
      // Reset manager to pick up platform mock
      manager.destroyAll()
    })

    afterEach(() => {
      platformSpy.mockRestore()
    })

    it('uses default shell when shellPath not provided', () => {
      manager.create()
      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String), // default shell
        expect.any(Array),
        expect.objectContaining({ name: 'xterm-256color' })
      )
    })

    it('uses shellPath when provided and in allowlist', async () => {
      // Pre-populate the allowlist via initializeShells mocked to resolve with fish
      const { detectMacosShells: mockDetect } = await import('../macos-shell-detector')
      vi.mocked(mockDetect as unknown as (...args: unknown[]) => unknown).mockResolvedValueOnce([
        { path: '/usr/local/bin/fish', name: 'fish', isDefault: false, kind: 'unix' as const },
      ])

      const freshManager = new TerminalManager()
      freshManager.initializeShells()
      // Wait for the detection promise to settle
      await freshManager.getAvailableShells()

      freshManager.create({ shellPath: '/usr/local/bin/fish' })
      expect(pty.spawn).toHaveBeenCalledWith(
        '/usr/local/bin/fish',
        expect.any(Array),
        expect.objectContaining({ name: 'xterm-256color' })
      )
      freshManager.destroyAll()
    })

    it('falls back to default shell when shellPath not in allowlist (security)', async () => {
      const { detectMacosShells: mockDetect } = await import('../macos-shell-detector')
      vi.mocked(mockDetect as unknown as (...args: unknown[]) => unknown).mockResolvedValueOnce([
        { path: '/bin/zsh', name: 'zsh', isDefault: true, kind: 'unix' as const },
      ])

      const freshManager = new TerminalManager()
      freshManager.initializeShells()
      await freshManager.getAvailableShells()

      freshManager.create({ shellPath: '/tmp/evil-shell' })
      expect(pty.spawn).toHaveBeenCalledWith(
        expect.not.stringContaining('evil'),
        expect.any(Array),
        expect.objectContaining({ name: 'xterm-256color' })
      )
      freshManager.destroyAll()
    })

    it('ignores shellPath on Windows — existing Windows tests unaffected', () => {
      platformSpy.mockReturnValue('win32')
      const winManager = new TerminalManager()
      winManager.create({ shell: { type: 'cmd' }, shellPath: '/tmp/ignored' })
      // On Windows, cmd.exe is used regardless of shellPath
      expect(pty.spawn).toHaveBeenCalledWith(
        expect.stringContaining('cmd'),
        expect.any(Array),
        expect.objectContaining({ name: 'xterm-256color' })
      )
      winManager.destroyAll()
    })

    it('returns --login for fish shell (H2)', async () => {
      const { detectMacosShells: mockDetect } = await import('../macos-shell-detector')
      vi.mocked(mockDetect as unknown as (...args: unknown[]) => unknown).mockResolvedValueOnce([
        { path: '/usr/local/bin/fish', name: 'fish', isDefault: false, kind: 'unix' as const },
      ])

      const freshManager = new TerminalManager()
      freshManager.initializeShells()
      await freshManager.getAvailableShells()

      freshManager.create({ shellPath: '/usr/local/bin/fish' })
      expect(pty.spawn).toHaveBeenCalledWith(
        '/usr/local/bin/fish',
        ['--login'],
        expect.objectContaining({ name: 'xterm-256color' })
      )
      freshManager.destroyAll()
    })

    it('returns -l for bash/zsh/sh (H2)', async () => {
      const { detectMacosShells: mockDetect } = await import('../macos-shell-detector')
      vi.mocked(mockDetect as unknown as (...args: unknown[]) => unknown).mockResolvedValueOnce([
        { path: '/bin/zsh', name: 'zsh', isDefault: true, kind: 'unix' as const },
      ])

      const freshManager = new TerminalManager()
      freshManager.initializeShells()
      await freshManager.getAvailableShells()

      freshManager.create({ shellPath: '/bin/zsh' })
      expect(pty.spawn).toHaveBeenCalledWith(
        '/bin/zsh',
        ['-l'],
        expect.objectContaining({ name: 'xterm-256color' })
      )
      freshManager.destroyAll()
    })

    it('returns [] for unknown shell name (H2)', async () => {
      const { detectMacosShells: mockDetect } = await import('../macos-shell-detector')
      vi.mocked(mockDetect as unknown as (...args: unknown[]) => unknown).mockResolvedValueOnce([
        { path: '/usr/local/bin/nu', name: 'nu', isDefault: false, kind: 'unix' as const },
      ])

      const freshManager = new TerminalManager()
      freshManager.initializeShells()
      await freshManager.getAvailableShells()

      freshManager.create({ shellPath: '/usr/local/bin/nu' })
      expect(pty.spawn).toHaveBeenCalledWith(
        '/usr/local/bin/nu',
        [],
        expect.objectContaining({ name: 'xterm-256color' })
      )
      freshManager.destroyAll()
    })
  })

  describe('rebuildHeadless', () => {
    it('rebuilds headless from outputBuffer so getSnapshot reflects raw content', async () => {
      const term = manager.create()

      // Emit some output via the PTY data callback (populates both headless + outputBuffer)
      mockPty._dataCallback?.('hello reflow world\r\n')

      // Force-resize headless to a different width to simulate the reflow scenario
      manager.resize(term.id, 40, 24)

      // Rebuild from raw at current cols
      await manager.rebuildHeadless(term.id)

      const snap = await manager.getSnapshot(term.id)
      // Snapshot should still contain the text that was in outputBuffer
      expect(snap.data).toContain('hello reflow world')
    })

    it('is idempotent — multiple consecutive calls do not duplicate content', async () => {
      const term = manager.create()
      mockPty._dataCallback?.('idempotent test\r\n')

      await manager.rebuildHeadless(term.id)
      const snap1 = await manager.getSnapshot(term.id)

      await manager.rebuildHeadless(term.id)
      const snap2 = await manager.getSnapshot(term.id)

      await manager.rebuildHeadless(term.id)
      const snap3 = await manager.getSnapshot(term.id)

      // Each call must NOT duplicate content
      const count1 = (snap1.data.match(/idempotent test/g) || []).length
      const count2 = (snap2.data.match(/idempotent test/g) || []).length
      const count3 = (snap3.data.match(/idempotent test/g) || []).length

      expect(count1).toBe(1)
      expect(count2).toBe(1)
      expect(count3).toBe(1)
    })

    it('replays raw transcript with resize history so old redraw lines are not baked in', async () => {
      const term = manager.create()

      manager.resize(term.id, 20, 8)
      mockPty._dataCallback?.('12345678901234567890')
      mockPty._dataCallback?.('\r\x1b[Kshort\r\n')
      manager.resize(term.id, 8, 8)

      await manager.rebuildHeadless(term.id)
      const snap = await manager.getSnapshot(term.id)

      expect(snap.data).toContain('short')
      expect(snap.data).not.toContain('1234567890123456')
    })

    it('does not duplicate live PTY data that arrives during rebuild', async () => {
      const term = manager.create()

      // Initial output before rebuild
      mockPty._dataCallback?.('initial-marker\r\n')

      // Start rebuild (don't await yet — simulate concurrent PTY data during rebuild)
      const rebuildPromise = manager.rebuildHeadless(term.id)

      // Simulate concurrent PTY data arriving while rebuild is in progress
      mockPty._dataCallback?.('concurrent-marker\r\n')

      await rebuildPromise

      const snap = await manager.getSnapshot(term.id)

      // Each marker should appear EXACTLY ONCE — no duplication from live write + replay
      const initialCount = (snap.data.match(/initial-marker/g) || []).length
      const concurrentCount = (snap.data.match(/concurrent-marker/g) || []).length

      expect(initialCount).toBe(1)
      expect(concurrentCount).toBe(1)
    })

    it('preserves a resize that arrives while headless is rebuilding', async () => {
      const term = manager.create()
      mockPty._dataCallback?.('before-resize\r\n')

      const rebuildPromise = manager.rebuildHeadless(term.id)
      manager.resize(term.id, 40, 12)
      await rebuildPromise

      const snap = await manager.getSnapshot(term.id)
      expect(snap.cols).toBe(40)
      expect(snap.rows).toBe(12)
    })

    it('applies a resize that arrives while replaying rebuild tail bytes', async () => {
      const term = manager.create()
      mockPty._dataCallback?.('before-tail\r\n')

      const replayTarget = manager as unknown as {
        replayPayloadWithResizeHistory: (...args: unknown[]) => Promise<boolean>
      }
      const originalReplay = replayTarget.replayPayloadWithResizeHistory.bind(replayTarget)
      const replaySpy = vi.spyOn(replayTarget, 'replayPayloadWithResizeHistory')
      replaySpy.mockImplementation(async (...args: unknown[]) => {
        if (replaySpy.mock.calls.length === 2) {
          manager.resize(term.id, 52, 13)
        }
        return originalReplay(...args)
      })

      const rebuildPromise = manager.rebuildHeadless(term.id)
      mockPty._dataCallback?.('tail-bytes\r\n')
      await rebuildPromise

      const snap = await manager.getSnapshot(term.id)
      expect(snap.cols).toBe(52)
      expect(snap.rows).toBe(13)
    })

    it('is a no-op and does not throw when terminal is destroying', async () => {
      const term = manager.create()
      mockPty._dataCallback?.('some output\r\n')

      // Start async destroy (sets destroying = true but doesn't resolve until onExit)
      void manager.destroyAsync(term.id)

      // Should not throw even though the terminal is in a destroying state
      await expect(manager.rebuildHeadless(term.id)).resolves.toBeUndefined()

      // Finalize destroy so afterEach cleanup doesn't warn
      mockPty._exitCallback?.({ exitCode: 0 })
    })

    it('is a no-op and does not throw for a non-existent terminal id', async () => {
      await expect(manager.rebuildHeadless('does-not-exist')).resolves.toBeUndefined()
    })

    it('serializes overlapping calls (C1) — second call returns immediately, no duplication', async () => {
      const term = manager.create()
      mockPty._dataCallback?.('serialize-marker\r\n')

      // Start two overlapping rebuilds. Without serialization, the second would
      // dispose the freshTerm of the first mid-flight and corrupt content.
      const a = manager.rebuildHeadless(term.id)
      const b = manager.rebuildHeadless(term.id)

      await Promise.all([a, b])

      const snap = await manager.getSnapshot(term.id)
      const count = (snap.data.match(/serialize-marker/g) || []).length
      expect(count).toBe(1)
    })

    it('survives outputBuffer trim during replay (C2) — no duplication or content loss', async () => {
      const term = manager.create()

      // Seed with the marker we're going to verify after the rebuild settles.
      mockPty._dataCallback?.('pre-replay-marker\r\n')

      // Kick off rebuild — this captures replayPayload + replayEndByte synchronously.
      const rebuildPromise = manager.rebuildHeadless(term.id)

      // While rebuild's freshTerm.write is awaiting the resolve callback, push
      // enough data through onData to overflow the buffer cap and force a trim.
      // The trim shifts bufferStartOffset; the rebuild must use absolute byte
      // positions (not raw indices) to compute the tail correctly.
      const overflow = 'X'.repeat(TERMINAL_OUTPUT_BUFFER_MAX - TERMINAL_OUTPUT_BUFFER_TRIM_TO + 1024)
      mockPty._dataCallback?.(overflow)
      mockPty._dataCallback?.('post-trim-marker\r\n')

      await rebuildPromise

      const snap = await manager.getSnapshot(term.id)
      // The post-trim marker must appear exactly once — neither lost (buggy slice
      // returning empty) nor duplicated (buggy slice repeating replayed content).
      const postCount = (snap.data.match(/post-trim-marker/g) || []).length
      expect(postCount).toBe(1)
    })
  })

  describe('claude session ownership transfer', () => {
    it('does NOT re-parse keystrokes once an agent is detected (avoids TUI false positives)', () => {
      const t = manager.create({ cwd: '/work/app' })
      manager.write(t.id, 'claude --resume sess-K\r')
      expect(manager.get(t.id)?.claudeSessionId).toBe('sess-K')

      // Inside claude TUI, user types prompts that happen to start with "claude".
      // These must NOT clobber the live session binding.
      manager.write(t.id, 'claude is great\r')
      manager.write(t.id, 'claude\r')
      expect(manager.get(t.id)?.claudeSessionId).toBe('sess-K')
    })

    it('transfers session id when invokeClaudeCode resumes the same SID on another terminal', () => {
      const t1 = manager.create({ cwd: '/work/app' })
      manager.write(t1.id, 'claude --resume sess-X\r')
      expect(manager.get(t1.id)?.claudeSessionId).toBe('sess-X')

      const t2 = manager.create({ cwd: '/work/app' })
      const events: Array<{ terminalId: string; sessionId: string | undefined }> = []
      manager.on('claudeSessionIdChanged', (e: { terminalId: string; sessionId: string | undefined }) => events.push(e))

      // invokeClaudeCode is the IPC path for programmatic resume; it sets the SID directly.
      manager.invokeClaudeCode(t2.id, 'sess-X')

      expect(manager.get(t1.id)?.claudeSessionId).toBeUndefined()
      expect(manager.get(t2.id)?.claudeSessionId).toBe('sess-X')
      expect(manager.findByClaudeSessionId('sess-X')).toEqual({ id: t2.id })
      expect(events).toEqual([
        { terminalId: t1.id, sessionId: undefined },
        { terminalId: t2.id, sessionId: 'sess-X' }
      ])
    })

    it('attachClaudeSession rebinds when prior holder exited claude mode', () => {
      const t1 = manager.create({ cwd: '/work/app' })
      manager.write(t1.id, 'claude --resume sess-Z\r')
      expect(manager.get(t1.id)?.claudeSessionId).toBe('sess-Z')

      // Simulate t1 leaving claude mode (claude subprocess exited inside the terminal).
      const t1Meta = manager.get(t1.id)!
      t1Meta.isClaudeMode = false
      t1Meta.agentType = undefined

      const t2 = manager.create({ cwd: '/work/app' })
      manager.write(t2.id, 'claude\r')
      mockPty._dataCallback?.('hello')

      const result = manager.attachClaudeSession('sess-Z', '/work/app')
      expect(result).toEqual({ id: t2.id })
      expect(manager.get(t1.id)?.claudeSessionId).toBeUndefined()
      expect(manager.get(t2.id)?.claudeSessionId).toBe('sess-Z')
    })
  })
})
