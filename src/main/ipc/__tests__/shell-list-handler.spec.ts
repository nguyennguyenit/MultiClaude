import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks
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
}
vi.mock('@lydell/node-pty', () => ({ spawn: vi.fn(() => mockPty) }))

import { TerminalManager } from '../../terminal/terminal-manager'

describe('TERMINAL_GET_SHELLS handler (via TerminalManager)', () => {
  let manager: TerminalManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    process.env.SHELL = '/bin/zsh'
    mockSpawnSync.mockReturnValue({ status: 1 })
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
    mockRealpathSync.mockImplementation((p: string) => p)
    mockAccessSync.mockReturnValue(undefined)
    mockStatSync.mockReturnValue({ isFile: () => true, isSymbolicLink: () => false })
    mockReadFileSync.mockReturnValue('/bin/zsh\n/bin/bash\n')
    manager = new TerminalManager()
  })

  afterEach(() => {
    manager.destroyAll()
  })

  it('returns ShellInfo[] even when called before detectMacosShells resolves (C3: no race)', async () => {
    manager.initializeShells()
    // Call immediately — the promise is stored, result resolves correctly
    const result = await manager.getAvailableShells()
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns correct list after detectMacosShells resolves', async () => {
    manager.initializeShells()
    const result = await manager.getAvailableShells()
    expect(result.some(s => s.path === '/bin/zsh')).toBe(true)
  })

  it('detectMacosShells called only through initializeShells (C3: promise stored, not re-run)', async () => {
    manager.initializeShells()
    const call1 = manager.getAvailableShells()
    const call2 = manager.getAvailableShells()
    // Both calls get the same promise result
    const [r1, r2] = await Promise.all([call1, call2])
    expect(r1).toEqual(r2)
  })

  it('on Windows: includes cmd, powershell with correct kind field (H4)', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const winManager = new TerminalManager()
    winManager.initializeShells()
    const result = await winManager.getAvailableShells()
    const cmd = result.find(s => s.kind === 'cmd')
    const ps = result.find(s => s.kind === 'powershell')
    expect(cmd).toBeDefined()
    expect(ps).toBeDefined()
    winManager.destroyAll()
  })

  it('on Windows: includes WSL distros with kind: "wsl" (H4)', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const winManager = new TerminalManager()
    // Inject wslInfo manually — simulating pre-populated state
    ;(winManager as unknown as { wslInfo: { available: boolean; distros: Array<{ name: string; isDefault: boolean }> } }).wslInfo = {
      available: true,
      distros: [{ name: 'Ubuntu', isDefault: true }]
    }
    winManager.initializeShells()
    const result = await winManager.getAvailableShells()
    const wsl = result.find(s => s.kind === 'wsl')
    expect(wsl).toBeDefined()
    expect(wsl?.name).toBe('Ubuntu')
    winManager.destroyAll()
  })

  it('on macOS: delegates to detectMacosShells()', async () => {
    manager.initializeShells()
    const result = await manager.getAvailableShells()
    // All shells should have kind 'unix' on macOS
    expect(result.every(s => s.kind === 'unix')).toBe(true)
  })

  it('returns empty array when initializeShells not called', async () => {
    const result = await manager.getAvailableShells()
    expect(result).toEqual([])
  })
})
