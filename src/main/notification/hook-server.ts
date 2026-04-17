import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

export type HookHandler = (
  event: string,
  payload: Record<string, unknown>,
  rawRequest: IncomingMessage
) => Promise<HandlerResult>

export interface HandlerResult {
  status: number
  body?: Record<string, unknown> | string
  /** Allow handler to hold connection open (e.g., PermissionRequest long-poll). Caller must still resolve within budget. */
}

export interface HookServerOptions {
  secret: string
  handler?: HookHandler
  logger?: (level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) => void
  /** Body size cap. Default 1 MB. */
  bodyLimitBytes?: number
  /** Bind host. Default '127.0.0.1' literal. */
  host?: string
}

const DEFAULT_BODY_LIMIT = 1024 * 1024

const SECRET_HEADER = 'x-mc-hook-secret'
const REDACTED = '[REDACTED]'

/**
 * Loopback-only HTTP server for Claude Code hook delivery.
 * - Binds 127.0.0.1 literal.
 * - Verifies X-MC-Hook-Secret via timingSafeEqual.
 * - Parses JSON bodies (<= 1 MB).
 * - Routes path `/hook/<event>` -> handler(event, payload).
 * - Handler exceptions -> 200 empty body (never block agent).
 * - Secret redacted in logs.
 */
export class HookServer {
  private readonly options: Required<Omit<HookServerOptions, 'handler' | 'logger'>> & {
    handler?: HookHandler
    logger?: HookServerOptions['logger']
  }
  private server: Server | null = null
  private boundPort = 0

  constructor(opts: HookServerOptions) {
    this.options = {
      secret: opts.secret,
      bodyLimitBytes: opts.bodyLimitBytes ?? DEFAULT_BODY_LIMIT,
      host: opts.host ?? '127.0.0.1',
      handler: opts.handler,
      logger: opts.logger
    }
  }

  setHandler(h: HookHandler): void {
    this.options.handler = h
  }

  async start(preferredPort = 0): Promise<number> {
    if (this.server) return this.boundPort
    const server = createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        this.log('error', 'request-handler-crashed', { err: (err as Error).message })
        if (!res.headersSent) {
          res.statusCode = 200
          res.end()
        }
      })
    })
    this.server = server
    // OS-picked ephemeral port via listen(0) — avoids EADDRINUSE retry logic entirely.
    return await new Promise<number>((resolve, reject) => {
      server.once('error', reject)
      server.listen(preferredPort, this.options.host, () => {
        const addr = server.address()
        const actual = typeof addr === 'object' && addr ? addr.port : preferredPort
        this.boundPort = actual
        server.removeListener('error', reject)
        resolve(actual)
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.server) return
    const s = this.server
    this.server = null
    await new Promise<void>((resolve) => s.close(() => resolve()))
  }

  address(): { address: string; port: number } | null {
    if (!this.server) return null
    const addr = this.server.address()
    if (!addr || typeof addr === 'string') return null
    return { address: addr.address, port: addr.port }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }
    // Secret verification
    const provided = req.headers[SECRET_HEADER]
    const providedStr = Array.isArray(provided) ? provided[0] : provided ?? ''
    if (!secretsMatch(providedStr, this.options.secret)) {
      this.log('warn', 'hook-secret-mismatch', { url: req.url })
      res.statusCode = 403
      res.end()
      return
    }

    // Body read with cap
    const limit = this.options.bodyLimitBytes
    const chunks: Buffer[] = []
    let total = 0
    let exceeded = false
    for await (const chunk of req) {
      total += (chunk as Buffer).byteLength
      if (total > limit) {
        exceeded = true
        break
      }
      chunks.push(chunk as Buffer)
    }
    if (exceeded) {
      res.statusCode = 413
      res.end()
      return
    }
    const raw = Buffer.concat(chunks).toString('utf8')

    // Parse JSON (defensive — malformed body must not block agent)
    let payload: Record<string, unknown> = {}
    if (raw.length > 0) {
      try {
        const parsed = JSON.parse(raw)
        payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch {
        res.statusCode = 200
        res.end()
        return
      }
    }

    const event = this.parseEventPath(req.url ?? '')
    this.log('info', 'hook-in', { event })

    if (!this.options.handler) {
      res.statusCode = 200
      res.end()
      return
    }

    try {
      const result = await this.options.handler(event, payload, req)
      res.statusCode = result.status
      if (result.body === undefined) {
        res.end()
      } else if (typeof result.body === 'string') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(result.body)
      } else {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(result.body))
      }
    } catch (err) {
      this.log('error', 'hook-handler-error', { err: (err as Error).message })
      res.statusCode = 200
      res.end()
    }
  }

  private parseEventPath(url: string): string {
    const m = url.match(/^\/hook\/([^?#/]+)/)
    return m ? m[1] : 'unknown'
  }

  private log(level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>): void {
    if (!this.options.logger) return
    this.options.logger(level, msg, meta ? redactMeta(meta, this.options.secret) : undefined)
  }
}

function secretsMatch(provided: string, expected: string): boolean {
  if (provided.length === 0 || provided.length !== expected.length) return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function redactMeta(meta: Record<string, unknown>, secret: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string' && secret.length > 0 && v.includes(secret)) {
      out[k] = REDACTED
    } else {
      out[k] = v
    }
  }
  return out
}

