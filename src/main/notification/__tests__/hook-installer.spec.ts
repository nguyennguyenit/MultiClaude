import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HookInstaller } from '../hook-installer'

const MARKER = 'MultiClaude/test-1.0'

describe('HookInstaller', () => {
  let dir: string
  let settingsPath: string
  let installer: HookInstaller

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mc-install-'))
    settingsPath = join(dir, 'settings.json')
    installer = new HookInstaller({
      settingsPath,
      userAgent: MARKER,
      port: 12345,
      secret: 'sec1'
    })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates settings.json with nested schema when file missing', async () => {
    await installer.install()
    expect(existsSync(settingsPath)).toBe(true)
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(parsed.hooks).toBeDefined()
    expect(parsed.hooks.Stop).toBeInstanceOf(Array)
    expect(parsed.hooks.PreToolUse).toBeInstanceOf(Array)
    expect(parsed.hooks.PermissionRequest).toBeInstanceOf(Array)
    const stopHook = parsed.hooks.Stop[0].hooks[0]
    expect(stopHook.type).toBe('http')
    expect(stopHook.url).toContain('127.0.0.1:12345')
    expect(stopHook.headers['User-Agent']).toBe(MARKER)
  })

  it('is idempotent — running twice yields one entry per event', async () => {
    await installer.install()
    await installer.install()
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(parsed.hooks.Stop).toHaveLength(1)
    expect(parsed.hooks.PreToolUse).toHaveLength(1)
    expect(parsed.hooks.PermissionRequest).toHaveLength(1)
  })

  it('uninstall removes only our entries by User-Agent marker', async () => {
    // Pre-populate with ccpoke-style entry + our entry
    const ccpokeEntry = {
      matcher: '*',
      hooks: [{ type: 'command', command: 'node ~/.claude/hooks/opencode-notify.js' }]
    }
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [ccpokeEntry]
        },
        otherKey: { preserveMe: true }
      })
    )
    await installer.install()
    await installer.uninstall()
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(parsed.hooks.Stop).toHaveLength(1)
    expect(parsed.hooks.Stop[0]).toEqual(ccpokeEntry)
    expect(parsed.otherKey).toEqual({ preserveMe: true })
  })

  it('preserves unknown top-level keys across install/uninstall', async () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: { enabled: true },
        enabledPlugins: { foo: true }
      })
    )
    await installer.install()
    let parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(parsed.$schema).toBe('https://json.schemastore.org/claude-code-settings.json')
    expect(parsed.statusLine).toEqual({ enabled: true })
    expect(parsed.enabledPlugins).toEqual({ foo: true })
    await installer.uninstall()
    parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(parsed.$schema).toBe('https://json.schemastore.org/claude-code-settings.json')
    expect(parsed.statusLine).toEqual({ enabled: true })
  })

  it('refuses to install when settings.json is malformed (does NOT blind-overwrite)', async () => {
    writeFileSync(settingsPath, '{invalid json')
    await expect(installer.install()).rejects.toThrow()
    // File unchanged
    expect(readFileSync(settingsPath, 'utf8')).toBe('{invalid json')
  })

  it('uninstall on corrupt file throws user-facing error (no silent backup restore)', async () => {
    writeFileSync(settingsPath, '{broken')
    await expect(installer.uninstall()).rejects.toThrow(/malformed|parse/i)
  })

  it('status() reports presence of our entries', async () => {
    expect(await installer.status()).toEqual({ installed: false, eventCount: 0 })
    await installer.install()
    const s = await installer.status()
    expect(s.installed).toBe(true)
    expect(s.eventCount).toBe(3)
  })

  it('concurrent ccpoke-simulator writes preserve both entry sets', async () => {
    writeFileSync(settingsPath, JSON.stringify({ hooks: {} }))
    const ccpokeAdder = async () => {
      // Simulate ccpoke adding its own entry via same file-lock
      await installer.withLock(async () => {
        const raw = readFileSync(settingsPath, 'utf8')
        const obj = JSON.parse(raw)
        obj.hooks = obj.hooks ?? {}
        obj.hooks.PreToolUse = obj.hooks.PreToolUse ?? []
        obj.hooks.PreToolUse.push({
          matcher: '*',
          hooks: [{ type: 'command', command: 'node ccpoke.js' }]
        })
        writeFileSync(settingsPath, JSON.stringify(obj))
      })
    }
    await Promise.all([installer.install(), ccpokeAdder(), installer.install(), ccpokeAdder()])
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
    const ours = parsed.hooks.PreToolUse.filter((e: { hooks: Array<{ type: string; headers?: { 'User-Agent'?: string } }> }) =>
      e.hooks.some((h) => h.headers?.['User-Agent'] === MARKER)
    )
    const ccpoke = parsed.hooks.PreToolUse.filter((e: { hooks: Array<{ command?: string }> }) =>
      e.hooks.some((h) => h.command === 'node ccpoke.js')
    )
    expect(ours).toHaveLength(1)
    expect(ccpoke.length).toBeGreaterThanOrEqual(1)
  })

  it('rejects non-absolute settingsPath (safe-join guard)', () => {
    expect(() => new HookInstaller({
      settingsPath: 'relative/path.json',
      userAgent: MARKER,
      port: 1,
      secret: 'x'
    })).toThrow(/absolute/)
  })

  it('cleans up .tmp when atomicWrite rename fails unrecoverably', async () => {
    const failing = new HookInstaller({
      settingsPath,
      userAgent: MARKER,
      port: 12345,
      secret: 'sec',
      renameImpl: async () => {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' })
      }
    })
    await expect(failing.install()).rejects.toThrow()
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toHaveLength(0)
  })

  it('EBUSY on rename falls back to copyFile', async () => {
    const { copyFile, unlink, writeFile } = await import('node:fs/promises')
    let attempt = 0
    const fallback = new HookInstaller({
      settingsPath,
      userAgent: MARKER,
      port: 12345,
      secret: 'sec',
      renameImpl: async (src, dest) => {
        attempt += 1
        if (attempt === 1) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' })
        await writeFile(dest, readFileSync(src))
        await unlink(src)
        void copyFile
      }
    })
    await fallback.install()
    expect(existsSync(settingsPath)).toBe(true)
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toHaveLength(0)
  })

  it('updates entries on re-install when port or secret changes', async () => {
    await installer.install()
    const updated = new HookInstaller({
      settingsPath,
      userAgent: MARKER,
      port: 99999,
      secret: 'sec2'
    })
    await updated.install()
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(parsed.hooks.Stop).toHaveLength(1)
    expect(parsed.hooks.Stop[0].hooks[0].url).toContain('99999')
    expect(parsed.hooks.Stop[0].hooks[0].headers['X-MC-Hook-Secret']).toBe('sec2')
  })
})
