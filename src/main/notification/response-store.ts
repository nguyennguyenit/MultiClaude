import { randomUUID } from 'node:crypto'
import { readdirSync, existsSync, mkdirSync } from 'node:fs'
import { rename, readFile, writeFile, unlink, chmod, copyFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface ResponseEntry {
  id: string
  sessionId?: string
  terminalId?: string
  summary?: string
  lastAssistantMessage?: string
  gitDiff?: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

export interface ResponseStoreOptions {
  dir: string
  ttlMs?: number
  maxEntries?: number
  /** Test seam: override the atomic rename implementation to simulate EBUSY / EPERM. */
  renameImpl?: (src: string, dest: string) => Promise<void>
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX = 100

/**
 * UUID-indexed persistent response store.
 * - Files at <dir>/<uuid>.json, atomic write via .tmp + rename (EBUSY fallback: copyFile+unlink).
 * - 0o600 on POSIX. Windows: best-effort (accepted weakness, see README).
 * - 24h TTL with lazy cleanup on get; explicit cleanExpired for startup.
 * - LRU eviction by createdAt when size > maxEntries.
 * - Corrupted JSON files silently ignored (returns undefined).
 */
export class ResponseStore {
  private readonly dir: string
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly renameImpl: (src: string, dest: string) => Promise<void>

  constructor(options: ResponseStoreOptions) {
    this.dir = options.dir
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX
    this.renameImpl = options.renameImpl ?? ((src, dest) => rename(src, dest))
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true, mode: 0o700 })
    }
  }

  async put(entry: Omit<ResponseEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = randomUUID()
    const now = Date.now()
    const full: ResponseEntry = { ...entry, id, createdAt: now, updatedAt: now }
    await this.writeAtomic(id, full)
    await this.enforceCap()
    return id
  }

  async update(id: string, patch: Partial<Omit<ResponseEntry, 'id' | 'createdAt'>>): Promise<void> {
    const existing = await this.readEntry(id)
    if (!existing) return
    const merged: ResponseEntry = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt, updatedAt: Date.now() }
    await this.writeAtomic(id, merged)
  }

  async get(id: string): Promise<ResponseEntry | undefined> {
    const entry = await this.readEntry(id)
    if (!entry) return undefined
    if (entry.createdAt + this.ttlMs <= Date.now()) {
      await this.deleteFile(id)
      return undefined
    }
    return entry
  }

  async delete(id: string): Promise<void> {
    await this.deleteFile(id)
  }

  async cleanExpired(): Promise<void> {
    const ids = this.listIds()
    const now = Date.now()
    for (const id of ids) {
      const entry = await this.readEntry(id)
      if (!entry) continue
      if (entry.createdAt + this.ttlMs <= now) {
        await this.deleteFile(id)
      }
    }
  }

  async size(): Promise<number> {
    return this.listIds().length
  }

  private async readEntry(id: string): Promise<ResponseEntry | undefined> {
    const path = join(this.dir, `${id}.json`)
    if (!existsSync(path)) return undefined
    try {
      const raw = await readFile(path, 'utf8')
      const parsed = JSON.parse(raw) as ResponseEntry
      if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') return undefined
      return parsed
    } catch {
      return undefined
    }
  }

  private async writeAtomic(id: string, entry: ResponseEntry): Promise<void> {
    const final = join(this.dir, `${id}.json`)
    const tmp = `${final}.tmp`
    const body = JSON.stringify(entry, null, 2)
    await writeFile(tmp, body, { encoding: 'utf8', mode: 0o600 })
    try {
      await this.renameImpl(tmp, final)
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
    if (process.platform !== 'win32') {
      await chmod(final, 0o600).catch(() => undefined)
    }
  }

  private async deleteFile(id: string): Promise<void> {
    const path = join(this.dir, `${id}.json`)
    await unlink(path).catch(() => undefined)
  }

  private listIds(): string[] {
    if (!existsSync(this.dir)) return []
    return readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
  }

  private async enforceCap(): Promise<void> {
    const ids = this.listIds()
    if (ids.length <= this.maxEntries) return
    const entries: { id: string; createdAt: number }[] = []
    for (const id of ids) {
      const e = await this.readEntry(id)
      if (e) entries.push({ id: e.id, createdAt: e.createdAt })
    }
    entries.sort((a, b) => a.createdAt - b.createdAt)
    const toEvict = entries.slice(0, entries.length - this.maxEntries)
    for (const { id } of toEvict) {
      await this.deleteFile(id)
    }
  }

  /** Exposed for testing only. */
  async _fileSize(id: string): Promise<number | undefined> {
    const path = join(this.dir, `${id}.json`)
    if (!existsSync(path)) return undefined
    const s = await stat(path)
    return s.size
  }
}
