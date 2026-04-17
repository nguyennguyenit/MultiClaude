import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HookRouter } from '../hook-router'
import { ResponseStore } from '../response-store'
import { PendingQuestionStore } from '../pending-question-store'
import { PendingPermissionStore } from '../pending-permission-store'

describe('HookRouter', () => {
  let dir: string
  let store: ResponseStore
  let questionStore: PendingQuestionStore
  let permissionStore: PendingPermissionStore
  let router: HookRouter
  let events: Array<{ type: string; payload: Record<string, unknown> }>

  const makeRouter = (sessionToTerminal: Map<string, string> = new Map()) => {
    events = []
    return new HookRouter({
      responseStore: store,
      questionStore,
      permissionStore,
      resolveTerminalBySession: (sid) => sessionToTerminal.get(sid),
      emit: (type, payload) => events.push({ type, payload }),
      unknownSessionWaitMs: 50,
      logger: () => undefined
    })
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mc-router-'))
    store = new ResponseStore({ dir, ttlMs: 60_000, maxEntries: 10 })
    questionStore = new PendingQuestionStore()
    permissionStore = new PendingPermissionStore()
    router = makeRouter(new Map([['sess-A', 'term-1']]))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  describe('Stop event', () => {
    it('responds 200 immediately and persists response with responseId', async () => {
      const t0 = Date.now()
      const result = await router.handle('stop', { session_id: 'sess-A', hook_event_name: 'Stop' })
      const elapsed = Date.now() - t0
      expect(elapsed).toBeLessThan(100)
      expect(result.status).toBe(200)

      // Allow async work to land
      await new Promise((r) => setTimeout(r, 20))

      // TaskEvent emitted
      const complete = events.find((e) => e.type === 'taskComplete')
      expect(complete).toBeDefined()
      const responseId = (complete!.payload as Record<string, unknown>).responseId
      expect(typeof responseId).toBe('string')

      const saved = await store.get(responseId as string)
      expect(saved?.sessionId).toBe('sess-A')
      expect(saved?.terminalId).toBe('term-1')
    })

    it('ignores Stop events whose session_id has no terminal (after queue window)', async () => {
      const r = makeRouter(new Map())
      const result = await r.handle('stop', { session_id: 'unknown', hook_event_name: 'Stop' })
      expect(result.status).toBe(200)
      // Wait past the 50ms window
      await new Promise((r2) => setTimeout(r2, 80))
      expect(events.find((e) => e.type === 'taskComplete')).toBeUndefined()
    })

    it('resolves unknown session_id if terminal binds within queue window', async () => {
      const map = new Map<string, string>()
      const r = makeRouter(map)
      const p = r.handle('stop', { session_id: 'late', hook_event_name: 'Stop' })
      // Simulate JSONL watcher attaching
      setTimeout(() => map.set('late', 'term-late'), 10)
      await p
      await new Promise((r2) => setTimeout(r2, 80))
      const complete = events.find((e) => e.type === 'taskComplete')
      expect(complete).toBeDefined()
      expect((complete!.payload as Record<string, unknown>).terminalId).toBe('term-late')
    })
  })

  describe('PreToolUse AskUserQuestion', () => {
    it('routes AskUserQuestion into pending-question-store and emits reviewNeeded', async () => {
      const result = await router.handle('pre-tool-use', {
        session_id: 'sess-A',
        hook_event_name: 'PreToolUse',
        tool_name: 'AskUserQuestion',
        tool_input: {
          question: 'Pick one',
          options: [{ label: 'A' }, { label: 'B' }],
          multiSelect: false
        }
      })
      expect(result.status).toBe(200)
      const entry = questionStore.get('term-1')
      expect(entry?.question.options).toHaveLength(2)
      expect(events.find((e) => e.type === 'reviewNeeded')).toBeDefined()
    })

    it('ignores non-AskUserQuestion PreToolUse events', async () => {
      const result = await router.handle('pre-tool-use', {
        session_id: 'sess-A',
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' }
      })
      expect(result.status).toBe(200)
      expect(questionStore.get('term-1')).toBeUndefined()
    })

    it('tolerates missing question text (uses empty string)', async () => {
      const result = await router.handle('pre-tool-use', {
        session_id: 'sess-A',
        hook_event_name: 'PreToolUse',
        tool_name: 'AskUserQuestion',
        tool_input: { options: [{ label: 'Yes' }] }
      })
      expect(result.status).toBe(200)
      const entry = questionStore.get('term-1')
      expect(entry?.question.text).toBe('')
    })
  })

  describe('PermissionRequest', () => {
    it('waits for permission resolution before responding', async () => {
      const p = router.handle('permission-request', {
        session_id: 'sess-A',
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf x' }
      })
      // Allow event to register
      await new Promise((r) => setTimeout(r, 10))
      const pending = permissionStore.list()
      expect(pending).toHaveLength(1)
      permissionStore.resolve(pending[0].id, { behavior: 'allow' })
      const result = await p
      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } }
      })
    })

    it('returns deny on explicit deny resolution', async () => {
      const p = router.handle('permission-request', {
        session_id: 'sess-A',
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash',
        tool_input: {}
      })
      await new Promise((r) => setTimeout(r, 10))
      const pending = permissionStore.list()
      permissionStore.resolve(pending[0].id, { behavior: 'deny', message: 'nope' })
      const result = await p
      const body = result.body as Record<string, unknown>
      const hookOutput = body.hookSpecificOutput as Record<string, unknown>
      const decision = hookOutput.decision as Record<string, unknown>
      expect(decision.behavior).toBe('deny')
      expect(decision.message).toBe('nope')
    })

    it('auto-denies on 30s timeout', async () => {
      vi.useFakeTimers()
      const router2 = new HookRouter({
        responseStore: store,
        questionStore,
        permissionStore,
        resolveTerminalBySession: () => 'term-1',
        emit: () => undefined,
        permissionTimeoutMs: 30_000
      })
      const p = router2.handle('permission-request', {
        session_id: 'sess-A',
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash',
        tool_input: {}
      })
      // Advance past timeout
      await vi.advanceTimersByTimeAsync(30_001)
      const result = await p
      const body = result.body as Record<string, unknown>
      const hookOutput = body.hookSpecificOutput as Record<string, unknown>
      const decision = hookOutput.decision as Record<string, unknown>
      expect(decision.behavior).toBe('deny')
      expect(String(decision.message)).toContain('timeout')
      vi.useRealTimers()
    })
  })

  describe('defensive parsing', () => {
    it('unknown hook event path returns 200', async () => {
      const result = await router.handle('bogus', { session_id: 'sess-A' })
      expect(result.status).toBe(200)
    })

    it('payload missing session_id returns 200 without crash', async () => {
      const result = await router.handle('stop', {})
      expect(result.status).toBe(200)
    })
  })
})
