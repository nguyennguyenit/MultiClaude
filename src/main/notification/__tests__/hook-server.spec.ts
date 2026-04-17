import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { request as httpRequest } from 'node:http'
import { HookServer } from '../hook-server'

type HandlerResult = { status: number; body?: Record<string, unknown>; holdMs?: number }

const doPost = (
  port: number,
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body)
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers }
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (text += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }))
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })

describe('HookServer', () => {
  let server: HookServer
  let port: number
  const SECRET = 'test-secret-abc123'

  beforeEach(async () => {
    server = new HookServer({
      secret: SECRET,
      handler: async (_event, _payload): Promise<HandlerResult> => ({ status: 200, body: {} })
    })
    port = await server.start()
  })

  afterEach(async () => {
    await server.stop()
  })

  it('binds 127.0.0.1 and returns a random port above 10000', () => {
    expect(port).toBeGreaterThan(10000)
    expect(server.address()?.address).toBe('127.0.0.1')
  })

  it('rejects missing secret with 403', async () => {
    const { status } = await doPost(port, '/hook/stop', { session_id: 's' })
    expect(status).toBe(403)
  })

  it('rejects wrong secret with 403', async () => {
    const { status } = await doPost(port, '/hook/stop', { session_id: 's' }, { 'X-MC-Hook-Secret': 'wrong' })
    expect(status).toBe(403)
  })

  it('accepts matching secret and routes to handler', async () => {
    let called = 0
    server.setHandler(async () => {
      called += 1
      return { status: 200, body: { ok: true } }
    })
    const { status, body } = await doPost(port, '/hook/stop', { session_id: 's' }, { 'X-MC-Hook-Secret': SECRET })
    expect(status).toBe(200)
    expect(called).toBe(1)
    expect(JSON.parse(body)).toEqual({ ok: true })
  })

  it('returns 200 for unknown event path (agent must not block)', async () => {
    const { status } = await doPost(port, '/hook/unknown-type', { session_id: 's' }, { 'X-MC-Hook-Secret': SECRET })
    expect(status).toBe(200)
  })

  it('parses JSON body and passes to handler', async () => {
    let receivedEvent = ''
    let receivedPayload: unknown = null
    server.setHandler(async (event, payload) => {
      receivedEvent = event
      receivedPayload = payload
      return { status: 200 }
    })
    await doPost(
      port,
      '/hook/pre-tool-use',
      { session_id: 'abc', tool_name: 'Bash' },
      { 'X-MC-Hook-Secret': SECRET }
    )
    expect(receivedEvent).toBe('pre-tool-use')
    expect(receivedPayload).toEqual({ session_id: 'abc', tool_name: 'Bash' })
  })

  it('rejects bodies > 1 MB with 413', async () => {
    const big = 'x'.repeat(1024 * 1024 + 10)
    const payload = JSON.stringify({ data: big })
    const { status } = await doPost(port, '/hook/stop', payload, { 'X-MC-Hook-Secret': SECRET })
    expect(status).toBe(413)
  })

  it('returns 200 on invalid JSON (defensive: never block agent)', async () => {
    const { status } = await doPost(port, '/hook/stop', '{not json', { 'X-MC-Hook-Secret': SECRET })
    expect(status).toBe(200)
  })

  it('rejects non-POST methods with 405', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = httpRequest(
        { host: '127.0.0.1', port, method: 'GET', path: '/hook/stop' },
        (res) => {
          expect(res.statusCode).toBe(405)
          res.resume()
          res.on('end', () => resolve())
        }
      )
      req.on('error', reject)
      req.end()
    })
  })

  it('rejects external interface binds (sanity: only 127.0.0.1 allowed)', () => {
    expect(server.address()?.address).not.toBe('0.0.0.0')
    expect(server.address()?.address).not.toBe('::')
  })

  it('stops cleanly and frees port', async () => {
    await server.stop()
    await expect(doPost(port, '/hook/stop', {}, { 'X-MC-Hook-Secret': SECRET })).rejects.toThrow()
  })

  it('redacts secret header in structured logs', async () => {
    const logs: unknown[] = []
    const s2 = new HookServer({
      secret: SECRET,
      handler: async () => ({ status: 200 }),
      logger: (level, msg, meta) => logs.push({ level, msg, meta })
    })
    const p2 = await s2.start()
    await doPost(p2, '/hook/stop', { x: 1 }, { 'X-MC-Hook-Secret': SECRET })
    await s2.stop()
    const rendered = JSON.stringify(logs)
    expect(rendered.includes(SECRET)).toBe(false)
  })

  it('timed-out handlers still return a response (safety net)', async () => {
    server.setHandler(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return { status: 200, body: { slow: true } }
    })
    const { status, body } = await doPost(port, '/hook/stop', { x: 1 }, { 'X-MC-Hook-Secret': SECRET })
    expect(status).toBe(200)
    expect(JSON.parse(body).slow).toBe(true)
  })

  it('handler exceptions return 200 with empty body (never block agent)', async () => {
    server.setHandler(async () => {
      throw new Error('boom')
    })
    const { status, body } = await doPost(port, '/hook/stop', { x: 1 }, { 'X-MC-Hook-Secret': SECRET })
    expect(status).toBe(200)
    expect(body).toBe('')
  })
})
