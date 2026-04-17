import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MobileControlManager } from '../mobile-control-manager'

const TERMINAL_MAP = new Map([['sess-A', 'term-1']])

describe('MobileControlManager', () => {
  let dir: string
  let claudeDir: string
  let responsesDir: string
  let settingsPath: string
  let electronStoreStub: { mobileControlSecret?: string } = {}

  beforeEach(() => {
    electronStoreStub = {}
    // Stub electron-store before MobileControlManager import-time requires
    vi.doMock('electron-store', () => ({
      default: class {
        constructor(_cfg: unknown) {}
        get(key: string) {
          return (electronStoreStub as Record<string, unknown>)[key]
        }
        set(key: string, value: unknown) {
          ;(electronStoreStub as Record<string, unknown>)[key] = value
        }
      }
    }))
    dir = mkdtempSync(join(tmpdir(), 'mc-mgr-'))
    claudeDir = join(dir, 'claude')
    responsesDir = join(dir, 'responses')
    settingsPath = join(claudeDir, 'settings.json')
  })

  afterEach(() => {
    vi.resetModules()
    rmSync(dir, { recursive: true, force: true })
  })

  const makeManager = async (): Promise<MobileControlManager> => {
    const mod = await import('../mobile-control-manager')
    return new mod.MobileControlManager({
      claudeDir,
      responsesDir,
      claudeSettingsPath: settingsPath,
      userAgentVersion: 'MultiClaude/test',
      resolveTerminalBySession: (sid) => TERMINAL_MAP.get(sid)
    })
  }

  it('enable() starts server, installs hooks, creates responses dir', async () => {
    const mgr = await makeManager()
    const status = await mgr.enable()
    expect(status.running).toBe(true)
    expect(status.port).toBeGreaterThan(10000)
    expect(status.installStatus.installed).toBe(true)
    expect(status.installStatus.eventCount).toBe(3)
    expect(existsSync(responsesDir)).toBe(true)
    expect(existsSync(join(responsesDir, 'README.txt'))).toBe(true)
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(parsed.hooks.Stop[0].hooks[0].type).toBe('http')
    await mgr.disable()
  })

  it('disable() stops server and uninstalls hooks', async () => {
    const mgr = await makeManager()
    await mgr.enable()
    const status = await mgr.disable()
    expect(status.running).toBe(false)
    expect(status.installStatus.installed).toBe(false)
  })

  it('secretFingerprint is sha256 prefix, not raw secret prefix', async () => {
    const mgr = await makeManager()
    const s = await mgr.enable()
    const raw = electronStoreStub.mobileControlSecret ?? ''
    expect(raw.length).toBeGreaterThan(32)
    // Fingerprint MUST NOT be a slice of the raw secret
    expect(raw.startsWith(s.secretFingerprint ?? '___nope___')).toBe(false)
    // Deterministic: sha256(raw).slice(0,8)
    const { createHash } = await import('node:crypto')
    const expected = createHash('sha256').update(raw).digest('hex').slice(0, 8)
    expect(s.secretFingerprint).toBe(expected)
    await mgr.disable()
  })

  it('secret persists across instances', async () => {
    const first = await makeManager()
    const s1 = await first.enable()
    const fp1 = s1.secretFingerprint
    await first.disable()
    const second = await makeManager()
    const s2 = await second.enable()
    expect(s2.secretFingerprint).toBe(fp1)
    await second.disable()
  })

  it('regenerateSecret rotates fingerprint while running', async () => {
    const mgr = await makeManager()
    const s1 = await mgr.enable()
    const fp1 = s1.secretFingerprint
    const s2 = await mgr.regenerateSecret()
    expect(s2.running).toBe(true)
    expect(s2.secretFingerprint).not.toBe(fp1)
    await mgr.disable()
  })

  it('self-check failure surfaces via error field', async () => {
    const mgr = await makeManager()
    // Force fetch to reject for the self-check
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => {
      throw new Error('loopback blocked')
    }) as unknown as typeof fetch
    const status = await mgr.enable()
    expect(status.running).toBe(false)
    expect(status.error).toContain('self-check failed')
    globalThis.fetch = originalFetch
  })

  it('exposes ccpoke detection in status', async () => {
    const hooksDir = join(claudeDir, 'hooks')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(join(hooksDir, 'opencode-notify.js'), '// ccpoke')
    const mgr = await makeManager()
    const status = await mgr.enable()
    expect(status.ccpokeDetected).toBe(true)
    await mgr.disable()
  })

  it('emits hook:event for Stop → taskComplete', async () => {
    const mgr = await makeManager()
    const status = await mgr.enable()
    const events: Array<{ type: string; payload: Record<string, unknown> }> = []
    mgr.on('hook:event', (ev) => events.push(ev))
    const res = await fetch(`http://127.0.0.1:${status.port}/hook/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MC-Hook-Secret': status.secretFingerprint ? (electronStoreStub.mobileControlSecret ?? '') : '' },
      body: JSON.stringify({ session_id: 'sess-A', hook_event_name: 'Stop' })
    })
    expect(res.status).toBe(200)
    await new Promise((r) => setTimeout(r, 50))
    const complete = events.find((e) => e.type === 'taskComplete')
    expect(complete).toBeDefined()
    await mgr.disable()
  })
})
