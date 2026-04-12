/**
 * Integration tests: shell switching full flow.
 * Exercises the detect → cache → IPC → create path end-to-end.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const mockReadFileSync = vi.hoisted(() => vi.fn())
const mockAccessSync = vi.hoisted(() => vi.fn())
const mockStatSync = vi.hoisted(() => vi.fn())
const mockRealpathSync = vi.hoisted(() => vi.fn())
const mockSpawnSync = vi.hoisted(() => vi.fn())
const mockExistsSync = vi.hoisted(() => vi.fn())
const mockReaddirSync = vi.hoisted(() => vi.fn())

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: mockReadFileSync,
    accessSync: mockAccessSync,
    statSync: mockStatSync,
    realpathSync: mockRealpathSync,
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
  }
})

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    spawnSync: mockSpawnSync,
    execFileSync: vi.fn().mockImplementation(() => { throw new Error('no dscl') }),
  }
})

const mockPty = {
  onData: vi.fn(),
  onExit: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  pid: 12345,
}
vi.mock('@lydell/node-pty', () => ({ spawn: vi.fn(() => mockPty) }))

import * as pty from '@lydell/node-pty'
import { TerminalManager } from '../terminal-manager'

// ── Helpers ─────────────────────────────────────────────────────────────────

function setupMacosEnv() {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
  process.env.SHELL = '/bin/zsh'
  mockSpawnSync.mockReturnValue({ status: 1 })
  mockExistsSync.mockReturnValue(false)
  mockReaddirSync.mockReturnValue([])
  mockRealpathSync.mockImplementation((p: string) => p)
  mockAccessSync.mockReturnValue(undefined)
  mockStatSync.mockReturnValue({ isFile: () => true, isSymbolicLink: () => false })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('shell switching — full flow', () => {
  let manager: TerminalManager
  let platformSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    setupMacosEnv()
    manager = new TerminalManager()
  })

  afterEach(() => {
    manager.destroyAll()
    platformSpy.mockRestore()
  })

  it('detect → cache → IPC → create with shellPath', async () => {
    // /etc/shells: zsh + fish
    mockReadFileSync.mockReturnValue('/bin/zsh\n/usr/local/bin/fish\n')
    // Both paths executable; fish resolves to itself
    mockRealpathSync.mockImplementation((p: string) => p)
    mockAccessSync.mockReturnValue(undefined)
    mockStatSync.mockReturnValue({ isFile: () => true, isSymbolicLink: () => false })

    manager.initializeShells()
    const shells = await manager.getAvailableShells()

    // Both shells detected
    expect(shells.some(s => s.path === '/bin/zsh')).toBe(true)
    expect(shells.some(s => s.path === '/usr/local/bin/fish')).toBe(true)

    // Create terminal with fish shellPath
    manager.create({ shellPath: '/usr/local/bin/fish' })
    expect(pty.spawn).toHaveBeenCalledWith(
      '/usr/local/bin/fish',
      ['--login'],  // fish gets --login
      expect.objectContaining({ name: 'xterm-256color' })
    )
  })

  it('rejects unknown shellPath silently — uses default', async () => {
    // Only /bin/zsh in /etc/shells
    mockReadFileSync.mockReturnValue('/bin/zsh\n')
    mockRealpathSync.mockImplementation((p: string) => p)
    mockAccessSync.mockReturnValue(undefined)
    mockStatSync.mockReturnValue({ isFile: () => true, isSymbolicLink: () => false })

    manager.initializeShells()
    await manager.getAvailableShells()

    // Attempt to create terminal with a path NOT in the allowlist
    manager.create({ shellPath: '/tmp/evil-shell' })
    expect(pty.spawn).toHaveBeenCalledWith(
      expect.not.stringContaining('evil'),
      expect.any(Array),
      expect.objectContaining({ name: 'xterm-256color' })
    )
  })

  it('Windows flow unchanged: cmd/powershell/wsl still work', async () => {
    platformSpy.mockReturnValue('win32')
    const winManager = new TerminalManager()

    // cmd
    winManager.create({ shell: { type: 'cmd' } })
    expect(pty.spawn).toHaveBeenCalledWith(
      expect.stringContaining('cmd'),
      [],
      expect.objectContaining({ name: 'xterm-256color' })
    )

    // powershell (no pwsh.exe available → falls back to powershell.exe)
    vi.mocked(pty.spawn).mockClear()
    winManager.create({ shell: { type: 'powershell' } })
    expect(pty.spawn).toHaveBeenCalledWith(
      expect.stringContaining('powershell'),
      ['-NoLogo'],
      expect.objectContaining({ name: 'xterm-256color' })
    )

    // WSL distro
    vi.mocked(pty.spawn).mockClear()
    winManager.create({ shell: { type: 'wsl', distro: 'Ubuntu' } })
    expect(pty.spawn).toHaveBeenCalledWith(
      'wsl.exe',
      ['-d', 'Ubuntu'],
      expect.objectContaining({ name: 'xterm-256color' })
    )

    winManager.destroyAll()
  })
})
