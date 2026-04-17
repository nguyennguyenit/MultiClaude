import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ResponseStore } from '../response-store'

describe('ResponseStore', () => {
  let dir: string
  let store: ResponseStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mc-resp-'))
    store = new ResponseStore({ dir, ttlMs: 24 * 60 * 60 * 1000, maxEntries: 100 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('put returns a UUID and persists to disk', async () => {
    const id = await store.put({ summary: 'hello', sessionId: 's1' })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    const filePath = join(dir, `${id}.json`)
    expect(existsSync(filePath)).toBe(true)
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
    expect(parsed.id).toBe(id)
    expect(parsed.summary).toBe('hello')
    expect(parsed.sessionId).toBe('s1')
    expect(typeof parsed.createdAt).toBe('number')
  })

  it('get returns stored entry', async () => {
    const id = await store.put({ summary: 'x' })
    const got = await store.get(id)
    expect(got?.id).toBe(id)
    expect(got?.summary).toBe('x')
  })

  it('get returns undefined for unknown id', async () => {
    expect(await store.get('nonexistent')).toBeUndefined()
  })

  it('get returns undefined for expired entry and removes file', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000_000_000)
    store = new ResponseStore({ dir, ttlMs: 1000, maxEntries: 100 })
    const id = await store.put({ summary: 'old' })
    vi.setSystemTime(1_000_000_001_500)
    expect(await store.get(id)).toBeUndefined()
    expect(existsSync(join(dir, `${id}.json`))).toBe(false)
    vi.useRealTimers()
  })

  it('update mutates existing entry and re-persists', async () => {
    const id = await store.put({ summary: 'partial' })
    await store.update(id, { gitDiff: 'diff content', summary: 'full' })
    const got = await store.get(id)
    expect(got?.gitDiff).toBe('diff content')
    expect(got?.summary).toBe('full')
  })

  it('update on unknown id is a no-op', async () => {
    await expect(store.update('ghost', { summary: 'x' })).resolves.toBeUndefined()
  })

  it('evicts oldest when cap exceeded (LRU by createdAt)', async () => {
    store = new ResponseStore({ dir, ttlMs: 24 * 3600 * 1000, maxEntries: 2 })
    const a = await store.put({ summary: 'a' })
    await new Promise((r) => setTimeout(r, 5))
    const b = await store.put({ summary: 'b' })
    await new Promise((r) => setTimeout(r, 5))
    const c = await store.put({ summary: 'c' })
    expect(await store.get(a)).toBeUndefined()
    expect((await store.get(b))?.summary).toBe('b')
    expect((await store.get(c))?.summary).toBe('c')
    expect(existsSync(join(dir, `${a}.json`))).toBe(false)
  })

  it('atomic write cleans up .tmp on fs.rename failure (non-EBUSY throws)', async () => {
    let called = 0
    const failing = new ResponseStore({
      dir,
      ttlMs: 24 * 3600 * 1000,
      maxEntries: 100,
      renameImpl: async () => {
        called += 1
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' })
      }
    })
    await expect(failing.put({ summary: 'boom' })).rejects.toThrow()
    expect(called).toBe(1)
    const files = readdirSync(dir)
    expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0)
  })

  it('EBUSY triggers copyFile fallback and cleans tmp', async () => {
    const { copyFile, unlink, writeFile } = await import('node:fs/promises')
    let renames = 0
    const fallback = new ResponseStore({
      dir,
      ttlMs: 24 * 3600 * 1000,
      maxEntries: 100,
      renameImpl: async (src, dest) => {
        renames += 1
        if (renames === 1) {
          // Simulate EBUSY: destination copy happens via fallback path.
          throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' })
        }
        await writeFile(dest, readFileSync(src))
        await unlink(src)
        // Suppress unused to avoid lint: copyFile imported for signature parity.
        void copyFile
      }
    })
    const id = await fallback.put({ summary: 'ebusy' })
    expect((await fallback.get(id))?.summary).toBe('ebusy')
    const files = readdirSync(dir)
    expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0)
  })

  it('persists across restart (new instance reads same dir)', async () => {
    const id = await store.put({ summary: 'persist' })
    const store2 = new ResponseStore({ dir, ttlMs: 24 * 3600 * 1000, maxEntries: 100 })
    const got = await store2.get(id)
    expect(got?.summary).toBe('persist')
  })

  it('cleanExpired removes expired entries on startup', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000_000_000)
    store = new ResponseStore({ dir, ttlMs: 1000, maxEntries: 100 })
    const id = await store.put({ summary: 'old' })
    vi.setSystemTime(1_000_000_002_000)
    await store.cleanExpired()
    expect(existsSync(join(dir, `${id}.json`))).toBe(false)
    vi.useRealTimers()
  })

  it('applies 0o600 on POSIX (skipped on Windows)', async () => {
    if (process.platform === 'win32') return
    const id = await store.put({ summary: 'secret' })
    const stat = statSync(join(dir, `${id}.json`))
    expect((stat.mode & 0o777).toString(8)).toBe('600')
  })

  it('ignores corrupted JSON files on read', async () => {
    writeFileSync(join(dir, 'bad-id.json'), '{invalid json')
    expect(await store.get('bad-id')).toBeUndefined()
  })
})
