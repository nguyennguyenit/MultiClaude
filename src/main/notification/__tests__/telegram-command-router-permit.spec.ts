import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TelegramCommandRouter } from '../telegram-command-router'
import { pendingPermissionStore } from '../pending-permission-store'
import { callbackIdempotencyCache } from '../callback-idempotency'
import { callbackRateLimiter } from '../callback-rate-limiter'
import type { TerminalManager } from '../../terminal/terminal-manager'
import type { ProjectStore } from '../../project/project-store'

const mkTerminalManager = (): TerminalManager => ({
  list: () => [],
  get: () => undefined,
  getExitedSession: () => null
}) as unknown as TerminalManager

const mkProjectStore = (): ProjectStore => ({ list: () => [] }) as unknown as ProjectStore

describe('TelegramCommandRouter permit callback', () => {
  let router: TelegramCommandRouter
  let replies: string[]

  beforeEach(() => {
    replies = []
    // Reset idempotency + rate-limiter state between tests
    callbackIdempotencyCache.reset()
    callbackRateLimiter.reset()
    pendingPermissionStore.clear()
    router = new TelegramCommandRouter(
      mkTerminalManager(),
      mkProjectStore(),
      async (text) => {
        replies.push(text)
        return true
      }
    )
  })

  it('resolves pending permission with allow and sends confirmation', async () => {
    const resolveSpy = vi.fn()
    const entry = pendingPermissionStore.create({
      sessionId: 's1',
      terminalId: 't1',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
      resolve: resolveSpy
    })
    await router.handleCallback('cb-1', `permit:${entry.id}:allow`)
    expect(resolveSpy).toHaveBeenCalledWith({ behavior: 'allow' })
    expect(replies[0]).toContain('Allowed')
  })

  it('resolves with deny and deny message', async () => {
    const resolveSpy = vi.fn()
    const entry = pendingPermissionStore.create({
      sessionId: 's1',
      terminalId: 't1',
      toolName: 'Write',
      toolInput: {},
      resolve: resolveSpy
    })
    await router.handleCallback('cb-2', `permit:${entry.id}:deny`)
    expect(resolveSpy).toHaveBeenCalledWith({ behavior: 'deny', message: 'Denied from phone' })
  })

  it('replies when permission id is unknown or expired', async () => {
    await router.handleCallback('cb-3', 'permit:ghost:allow')
    expect(replies[0]).toMatch(/expired|answered/i)
  })

  it('ignores malformed permit data', async () => {
    await router.handleCallback('cb-4', 'permit:only')
    expect(pendingPermissionStore.size()).toBe(0)
  })

  it('is idempotent on duplicate callback_query.id', async () => {
    const resolveSpy = vi.fn()
    const entry = pendingPermissionStore.create({
      sessionId: 's',
      terminalId: 't',
      toolName: 'Bash',
      toolInput: {},
      resolve: resolveSpy
    })
    await router.handleCallback('cb-dup', `permit:${entry.id}:allow`)
    await router.handleCallback('cb-dup', `permit:${entry.id}:allow`)
    expect(resolveSpy).toHaveBeenCalledTimes(1)
  })
})
