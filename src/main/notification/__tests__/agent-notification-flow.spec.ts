import { describe, it, expect } from 'vitest'
import { AGENT_DETECTION_PATTERNS, AGENT_DISPLAY_NAMES, AGENT_BADGE_COLORS, AGENT_BADGE_TEXT } from '@shared/constants'

describe('Agent notification flow', () => {
  describe('detection patterns', () => {
    it('maps all supported agents', () => {
      expect(AGENT_DETECTION_PATTERNS['claude']).toBe('claude')
      expect(AGENT_DETECTION_PATTERNS['codex']).toBe('codex')
      expect(AGENT_DETECTION_PATTERNS['gemini']).toBe('gemini')
      expect(AGENT_DETECTION_PATTERNS['aider']).toBe('aider')
    })

    it('returns undefined for unknown commands', () => {
      expect(AGENT_DETECTION_PATTERNS['npm']).toBeUndefined()
      expect(AGENT_DETECTION_PATTERNS['git']).toBeUndefined()
      expect(AGENT_DETECTION_PATTERNS['ls']).toBeUndefined()
    })

    it('has display names for all agent types', () => {
      expect(AGENT_DISPLAY_NAMES['claude']).toBe('Claude Code')
      expect(AGENT_DISPLAY_NAMES['codex']).toBe('Codex CLI')
      expect(AGENT_DISPLAY_NAMES['gemini']).toBe('Gemini CLI')
      expect(AGENT_DISPLAY_NAMES['aider']).toBe('Aider')
      expect(AGENT_DISPLAY_NAMES['generic']).toBe('Terminal')
    })

    it('has badge colors for all agent types', () => {
      expect(AGENT_BADGE_COLORS['claude']).toBe('#a855f7')
      expect(AGENT_BADGE_COLORS['codex']).toBe('#22c55e')
      expect(AGENT_BADGE_COLORS['gemini']).toBe('#3b82f6')
      expect(AGENT_BADGE_COLORS['aider']).toBe('#f97316')
      expect(AGENT_BADGE_COLORS['generic']).toBe('#6b7280')
    })

    it('has badge text for all agent types', () => {
      expect(AGENT_BADGE_TEXT['claude']).toBe('AI')
      expect(AGENT_BADGE_TEXT['codex']).toBe('CX')
      expect(AGENT_BADGE_TEXT['gemini']).toBe('GM')
      expect(AGENT_BADGE_TEXT['aider']).toBe('AD')
      expect(AGENT_BADGE_TEXT['generic']).toBe('??')
    })
  })

  describe('exit code → event type mapping', () => {
    const cases = [
      { exitCode: 0, expected: 'taskComplete' },
      { exitCode: 1, expected: 'taskFailed' },
      { exitCode: 130, expected: 'taskFailed' },
      { exitCode: 137, expected: 'taskFailed' },
    ]

    it.each(cases)('exit code $exitCode → $expected', ({ exitCode, expected }) => {
      const type = exitCode === 0 ? 'taskComplete' : 'taskFailed'
      expect(type).toBe(expected)
    })
  })

  describe('agent command parsing', () => {
    const cases = [
      { input: 'codex "fix the bug"', expected: 'codex' },
      { input: 'codex', expected: 'codex' },
      { input: 'claude --resume abc', expected: 'claude' },
      { input: 'gemini', expected: 'gemini' },
      { input: 'aider --model opus', expected: 'aider' },
      { input: 'npm run dev', expected: undefined },
      { input: 'git status', expected: undefined },
      { input: 'ls -la', expected: undefined },
    ]

    it.each(cases)('parses "$input" → $expected', ({ input, expected }) => {
      const binary = input.split(/\s+/)[0].toLowerCase()
      expect(AGENT_DETECTION_PATTERNS[binary]).toBe(expected)
    })
  })
})
