import { readFile, writeFile, rename, mkdir, copyFile, unlink } from 'node:fs/promises'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import lockfile from 'proper-lockfile'

/**
 * Events we install hooks for.
 * Matcher '*' catches all tools for PreToolUse / PermissionRequest.
 */
const HOOK_EVENTS = ['Stop', 'PreToolUse', 'PermissionRequest'] as const
type HookEvent = (typeof HOOK_EVENTS)[number]

const EVENT_PATH: Record<HookEvent, string> = {
  Stop: 'stop',
  PreToolUse: 'pre-tool-use',
  PermissionRequest: 'permission-request'
}

interface HttpHookEntry {
  type: 'http'
  url: string
  timeout?: number
  headers?: Record<string, string>
  allowedEnvVars?: string[]
}

interface HookMatcher {
  matcher: string
  hooks: Array<HttpHookEntry | Record<string, unknown>>
}

interface ClaudeSettings {
  hooks?: Partial<Record<HookEvent | string, HookMatcher[]>>
  [key: string]: unknown
}

export interface HookInstallerOptions {
  settingsPath: string
  userAgent: string
  port: number
  secret: string
  /** Override for tests. */
  lockRetries?: number
  /** Test seam: override atomic rename to simulate EBUSY / EPERM. */
  renameImpl?: (src: string, dest: string) => Promise<void>
}

export interface HookInstallStatus {
  installed: boolean
  eventCount: number
}

export class HookInstaller {
  private readonly opts: Required<Omit<HookInstallerOptions, 'renameImpl'>> & { renameImpl: (src: string, dest: string) => Promise<void> }

  constructor(options: HookInstallerOptions) {
    this.opts = {
      ...options,
      lockRetries: options.lockRetries ?? 5,
      renameImpl: options.renameImpl ?? ((src, dest) => rename(src, dest))
    }
    if (!isAbsolute(this.opts.settingsPath) || resolve(this.opts.settingsPath) !== this.opts.settingsPath) {
      throw new Error(`HookInstaller: settingsPath must be absolute + canonical: ${this.opts.settingsPath}`)
    }
  }

  async install(): Promise<void> {
    await this.withLock(async () => {
      const settings = await this.readSettingsOrSeed()
      settings.hooks = settings.hooks ?? {}
      for (const event of HOOK_EVENTS) {
        const list = (settings.hooks[event] as HookMatcher[] | undefined) ?? []
        const filtered = list.filter((m) => !this.isOurs(m))
        filtered.push(this.buildMatcher(event))
        settings.hooks[event] = filtered
      }
      await this.atomicWrite(settings)
    })
  }

  async uninstall(): Promise<void> {
    await this.withLock(async () => {
      if (!existsSync(this.opts.settingsPath)) return
      const settings = await this.readSettings()
      if (!settings.hooks) return
      for (const event of HOOK_EVENTS) {
        const list = settings.hooks[event] as HookMatcher[] | undefined
        if (!list) continue
        settings.hooks[event] = list.filter((m) => !this.isOurs(m))
      }
      await this.atomicWrite(settings)
    })
  }

  async status(): Promise<HookInstallStatus> {
    if (!existsSync(this.opts.settingsPath)) return { installed: false, eventCount: 0 }
    let settings: ClaudeSettings
    try {
      settings = await this.readSettings()
    } catch {
      return { installed: false, eventCount: 0 }
    }
    let count = 0
    for (const event of HOOK_EVENTS) {
      const list = settings.hooks?.[event] as HookMatcher[] | undefined
      if (list?.some((m) => this.isOurs(m))) count += 1
    }
    return { installed: count > 0, eventCount: count }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    if (!existsSync(this.opts.settingsPath)) {
      // Seed empty object so lockfile has a file to lock on
      await mkdir(dirname(this.opts.settingsPath), { recursive: true })
      writeFileSync(this.opts.settingsPath, '{}', { flag: 'a' })
    }
    const release = await lockfile.lock(this.opts.settingsPath, {
      retries: { retries: this.opts.lockRetries, minTimeout: 10, maxTimeout: 200 },
      stale: 10_000
    })
    try {
      return await fn()
    } finally {
      await release()
    }
  }

  private async readSettingsOrSeed(): Promise<ClaudeSettings> {
    if (!existsSync(this.opts.settingsPath)) return {}
    const raw = (await readFile(this.opts.settingsPath, 'utf8')).trim()
    if (raw.length === 0) return {}
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as ClaudeSettings
      throw new Error('settings.json root must be an object')
    } catch (err) {
      throw new Error(`Claude settings.json is malformed — refusing to overwrite: ${(err as Error).message}`)
    }
  }

  private async readSettings(): Promise<ClaudeSettings> {
    return this.readSettingsOrSeed()
  }

  private async atomicWrite(settings: ClaudeSettings): Promise<void> {
    const body = JSON.stringify(settings, null, 2)
    const final = this.opts.settingsPath
    const tmp = `${final}.tmp`
    await writeFile(tmp, body, { encoding: 'utf8' })
    try {
      await this.opts.renameImpl(tmp, final)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EBUSY' || code === 'EPERM') {
        try {
          await copyFile(tmp, final)
          await unlink(tmp).catch(() => undefined)
        } catch (copyErr) {
          await unlink(tmp).catch(() => undefined)
          throw copyErr
        }
      } else {
        await unlink(tmp).catch(() => undefined)
        throw err
      }
    }
  }

  private buildMatcher(event: HookEvent): HookMatcher {
    const path = EVENT_PATH[event]
    const entry: HttpHookEntry = {
      type: 'http',
      url: `http://127.0.0.1:${this.opts.port}/hook/${path}`,
      timeout: event === 'PermissionRequest' ? 35 : 10,
      headers: {
        'User-Agent': this.opts.userAgent,
        'X-MC-Hook-Secret': this.opts.secret
      }
    }
    return { matcher: '*', hooks: [entry] }
  }

  private isOurs(matcher: HookMatcher): boolean {
    if (!Array.isArray(matcher.hooks)) return false
    return matcher.hooks.some((h) => {
      if (!h || typeof h !== 'object') return false
      const rec = h as Record<string, unknown>
      const headers = rec.headers
      if (!headers || typeof headers !== 'object') return false
      const ua = (headers as Record<string, unknown>)['User-Agent']
      return typeof ua === 'string' && ua === this.opts.userAgent
    })
  }
}
