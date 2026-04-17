import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelegramAuthFlow } from '../telegram-auth-flow'

describe('TelegramAuthFlow', () => {
  let flow: TelegramAuthFlow
  let events: Array<{ name: string; payload?: unknown }>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-17T00:00:00Z'))
    events = []
    flow = new TelegramAuthFlow({ pairingWindowMs: 60_000, postSuccessWindowMs: 5_000 })
    flow.on('pairingWaiting', (p) => events.push({ name: 'waiting', payload: p }))
    flow.on('paired', (p) => events.push({ name: 'paired', payload: p }))
    flow.on('pairingTimeout', () => events.push({ name: 'timeout' }))
    flow.on('pairingWarning', (p) => events.push({ name: 'warning', payload: p }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('startPairing', () => {
    it('transitions to waiting and emits a hex nonce', () => {
      const { nonce } = flow.startPairing('bot-123')
      expect(flow.getState()).toBe('waiting')
      expect(nonce).toMatch(/^[0-9a-f]{16}$/)
      expect(events[0].name).toBe('waiting')
    })

    it('rejects a second concurrent startPairing while waiting', () => {
      flow.startPairing('bot-1')
      expect(() => flow.startPairing('bot-1')).toThrow(/already/i)
    })

    it('emits pairingTimeout after the window elapses', () => {
      flow.startPairing('bot-1')
      vi.advanceTimersByTime(60_001)
      expect(flow.getState()).toBe('idle')
      expect(events.map(e => e.name)).toContain('timeout')
    })
  })

  describe('completePairing', () => {
    it('accepts only when the nonce matches exactly', () => {
      const { nonce } = flow.startPairing('bot-1')
      const wrong = flow.completePairing('wrong-nonce', 12345)
      expect(wrong).toBe(false)
      expect(flow.getState()).toBe('waiting')

      const ok = flow.completePairing(nonce, 12345)
      expect(ok).toBe(true)
      expect(flow.getState()).toBe('completed')
      expect(events.map(e => e.name)).toContain('paired')
    })

    it('rejects when not in waiting state', () => {
      expect(flow.completePairing('abc', 1)).toBe(false)
    })

    it('is a single-shot: second call with matching nonce after success is a warning, not a re-pair', () => {
      const { nonce } = flow.startPairing('bot-1')
      flow.completePairing(nonce, 12345)
      const second = flow.completePairing(nonce, 67890)
      expect(second).toBe(false)
      const warn = events.find(e => e.name === 'warning')
      expect(warn).toBeDefined()
    })

    it('after post-success window, second matching /start is ignored (no warning spam)', () => {
      const { nonce } = flow.startPairing('bot-1')
      flow.completePairing(nonce, 12345)
      vi.advanceTimersByTime(5_001)
      events.length = 0
      flow.completePairing(nonce, 67890)
      expect(events.some(e => e.name === 'warning')).toBe(false)
    })
  })

  describe('cancelPairing', () => {
    it('resets state to idle and does not emit timeout', () => {
      flow.startPairing('bot-1')
      flow.cancelPairing()
      expect(flow.getState()).toBe('idle')
      vi.advanceTimersByTime(60_001)
      expect(events.some(e => e.name === 'timeout')).toBe(false)
    })

    it('is a no-op when not pairing', () => {
      expect(() => flow.cancelPairing()).not.toThrow()
      expect(flow.getState()).toBe('idle')
    })
  })

  describe('isMatchingNonce', () => {
    it('returns true while waiting and nonce matches', () => {
      const { nonce } = flow.startPairing('bot-1')
      expect(flow.isMatchingNonce(nonce)).toBe(true)
    })

    it('returns false when not pairing', () => {
      expect(flow.isMatchingNonce('abc')).toBe(false)
    })

    it('returns false for wrong nonce', () => {
      flow.startPairing('bot-1')
      expect(flow.isMatchingNonce('deadbeefdeadbeef')).toBe(false)
    })
  })
})
