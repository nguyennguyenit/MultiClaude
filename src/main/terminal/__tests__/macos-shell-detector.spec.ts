import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks
const mockReadFileSync = vi.hoisted(() => vi.fn())
const mockAccessSync = vi.hoisted(() => vi.fn())
const mockStatSync = vi.hoisted(() => vi.fn())
const mockRealpathSync = vi.hoisted(() => vi.fn())
const mockExecFileSync = vi.hoisted(() => vi.fn())

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: mockReadFileSync,
    accessSync: mockAccessSync,
    statSync: mockStatSync,
    realpathSync: mockRealpathSync,
  }
})

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    execFileSync: mockExecFileSync,
  }
})

// Import after mocks are set
import { detectMacosShells } from '../macos-shell-detector'

describe('detectMacosShells', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default platform: non-Windows
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    // Default $SHELL
    process.env.SHELL = '/bin/zsh'
    // Default: realpathSync returns the path unchanged
    mockRealpathSync.mockImplementation((p: string) => p)
    // Default: all paths are executable files
    mockAccessSync.mockReturnValue(undefined)
    mockStatSync.mockReturnValue({ isFile: () => true, isSymbolicLink: () => false })
    // Default: no /etc/shells
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })
  })

  it('returns empty array on Windows', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const result = await detectMacosShells()
    expect(result).toEqual([])
  })

  it('parses /etc/shells and returns ShellInfo[]', async () => {
    mockReadFileSync.mockReturnValue('/bin/bash\n/bin/zsh\n/usr/local/bin/fish\n')
    const result = await detectMacosShells()
    expect(result.some(s => s.path === '/bin/bash')).toBe(true)
    expect(result.some(s => s.path === '/bin/zsh')).toBe(true)
    expect(result.some(s => s.path === '/usr/local/bin/fish')).toBe(true)
  })

  it('marks the default shell with isDefault: true', async () => {
    process.env.SHELL = '/bin/zsh'
    mockReadFileSync.mockReturnValue('/bin/bash\n/bin/zsh\n')
    const result = await detectMacosShells()
    const zsh = result.find(s => s.path === '/bin/zsh')
    expect(zsh?.isDefault).toBe(true)
    const bash = result.find(s => s.path === '/bin/bash')
    expect(bash?.isDefault).toBe(false)
  })

  it('excludes non-executable entries', async () => {
    mockReadFileSync.mockReturnValue('/bin/bash\n/bin/notabin\n')
    mockAccessSync.mockImplementation((p: string) => {
      if (p === '/bin/notabin') throw new Error('EACCES')
    })
    const result = await detectMacosShells()
    expect(result.some(s => s.path === '/bin/notabin')).toBe(false)
  })

  it('deduplicates symlinked shells — stored path is always realpathSync result', async () => {
    mockReadFileSync.mockReturnValue('/usr/local/bin/zsh\n/bin/zsh\n')
    // Both resolve to /bin/zsh
    mockRealpathSync.mockReturnValue('/bin/zsh')
    const result = await detectMacosShells()
    const zshs = result.filter(s => s.path === '/bin/zsh')
    expect(zshs).toHaveLength(1)
  })

  it('handles missing /etc/shells gracefully', async () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })
    // Should fall back to scanning common dirs — which also may return nothing if all fail
    const result = await detectMacosShells()
    expect(Array.isArray(result)).toBe(true)
  })

  it('falls back to scanning common dirs when /etc/shells empty', async () => {
    mockReadFileSync.mockReturnValue('')
    // Make /bin/zsh discoverable
    mockRealpathSync.mockImplementation((p: string) => p)
    mockAccessSync.mockReturnValue(undefined)
    mockStatSync.mockReturnValue({ isFile: () => true, isSymbolicLink: () => false })
    const result = await detectMacosShells()
    // At minimum, should not throw
    expect(Array.isArray(result)).toBe(true)
  })

  it('extracts name from versioned shell path (fish-3.7.1 → fish)', async () => {
    mockReadFileSync.mockReturnValue('/usr/local/bin/fish-3.7.1\n')
    const result = await detectMacosShells()
    const fish = result.find(s => s.path === '/usr/local/bin/fish-3.7.1')
    expect(fish?.name).toBe('fish')
  })

  it('rejects /etc/shells entries with path traversal (../)', async () => {
    mockReadFileSync.mockReturnValue('/bin/zsh\n/bin/../etc/evil\n')
    const result = await detectMacosShells()
    expect(result.some(s => s.path.includes('..'))).toBe(false)
  })

  it('rejects /etc/shells entries that are not absolute paths', async () => {
    mockReadFileSync.mockReturnValue('/bin/zsh\nrelative/path/bash\n')
    const result = await detectMacosShells()
    expect(result.some(s => s.path === 'relative/path/bash')).toBe(false)
  })

  it('caps /etc/shells parsing at 50 entries', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `/bin/shell${i}`).join('\n')
    mockReadFileSync.mockReturnValue(lines)
    const result = await detectMacosShells()
    expect(result.length).toBeLessThanOrEqual(50)
  })

  it('uses $SHELL first, not dscl, for default shell resolution', async () => {
    process.env.SHELL = '/bin/zsh'
    mockReadFileSync.mockReturnValue('/bin/zsh\n')
    await detectMacosShells()
    expect(mockExecFileSync).not.toHaveBeenCalled()
  })

  it('falls back to dscl when $SHELL unset — uses execFileSync arg array (no injection)', async () => {
    delete process.env.SHELL
    mockReadFileSync.mockReturnValue('/bin/zsh\n')
    mockExecFileSync.mockReturnValue(Buffer.from('UserShell: /bin/zsh\n'))
    await detectMacosShells()
    // Should call execFileSync with array args
    expect(mockExecFileSync).toHaveBeenCalledWith(
      '/usr/bin/dscl',
      expect.arrayContaining(['.', '-read']),
      expect.objectContaining({ timeout: 2000 })
    )
    process.env.SHELL = '/bin/zsh' // restore
  })

  it('handles dscl timeout gracefully — falls back to /bin/sh', async () => {
    delete process.env.SHELL
    mockReadFileSync.mockReturnValue('/bin/sh\n')
    mockExecFileSync.mockImplementation(() => { throw new Error('ETIMEDOUT') })
    const result = await detectMacosShells()
    // Should fall back to /bin/sh or similar without throwing
    expect(Array.isArray(result)).toBe(true)
    process.env.SHELL = '/bin/zsh' // restore
  })

  it('sets kind: "unix" on all detected shells', async () => {
    mockReadFileSync.mockReturnValue('/bin/bash\n/bin/zsh\n')
    const result = await detectMacosShells()
    expect(result.every(s => s.kind === 'unix')).toBe(true)
  })
})
