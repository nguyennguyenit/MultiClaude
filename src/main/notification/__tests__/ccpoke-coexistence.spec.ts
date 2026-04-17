import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectCcpoke } from '../ccpoke-coexistence'

describe('detectCcpoke', () => {
  let dir: string
  let hooksDir: string
  let settingsPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mc-ccpoke-'))
    hooksDir = join(dir, 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    settingsPath = join(dir, 'settings.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns detected: false when no ccpoke files present', async () => {
    const result = await detectCcpoke({ claudeDir: dir })
    expect(result.detected).toBe(false)
    expect(result.reasons).toEqual([])
  })

  it('detects opencode-notify.js by filename', async () => {
    writeFileSync(join(hooksDir, 'opencode-notify.js'), '// ccpoke')
    const result = await detectCcpoke({ claudeDir: dir })
    expect(result.detected).toBe(true)
    expect(result.reasons.some((r) => r.includes('opencode-notify.js'))).toBe(true)
  })

  it('detects ccpoke by file content marker', async () => {
    writeFileSync(join(hooksDir, 'custom-hook.js'), '// ccpoke-style notifier shim')
    const result = await detectCcpoke({ claudeDir: dir })
    expect(result.detected).toBe(true)
  })

  it('detects ccpoke entry in settings.json', async () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'node ~/.claude/hooks/opencode-notify.js' }] }]
        }
      })
    )
    const result = await detectCcpoke({ claudeDir: dir })
    expect(result.detected).toBe(true)
    expect(result.reasons.some((r) => r.includes('settings.json'))).toBe(true)
  })

  it('ignores unrelated .js files', async () => {
    writeFileSync(join(hooksDir, 'privacy-block.cjs'), '// user privacy hook')
    writeFileSync(join(hooksDir, 'my-hook.js'), '// unrelated')
    const result = await detectCcpoke({ claudeDir: dir })
    expect(result.detected).toBe(false)
  })

  it('tolerates missing claude dir', async () => {
    const result = await detectCcpoke({ claudeDir: join(dir, 'nonexistent') })
    expect(result.detected).toBe(false)
  })

  it('tolerates malformed settings.json without throwing', async () => {
    writeFileSync(settingsPath, '{broken')
    const result = await detectCcpoke({ claudeDir: dir })
    expect(result.detected).toBe(false)
  })
})
