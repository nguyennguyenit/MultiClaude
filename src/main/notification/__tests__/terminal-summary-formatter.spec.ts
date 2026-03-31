import { describe, it, expect } from 'vitest'
import { cleanOutputForDisplay, buildDetailSummary } from '../terminal-summary-formatter'

describe('cleanOutputForDisplay', () => {
  it('strips ANSI color sequences', () => {
    expect(cleanOutputForDisplay('\x1b[31mred\x1b[0m')).toBe('red')
  })

  it('strips private mode sequences', () => {
    expect(cleanOutputForDisplay('\x1b[?2004htext\x1b[?2004l')).toBe('text')
  })

  it('simulates \\r overwrite — last segment after bare \\r survives', () => {
    expect(cleanOutputForDisplay('Loading...\rDone!')).toBe('Done!')
  })

  it('handles \\r in multiline output independently per line', () => {
    const result = cleanOutputForDisplay('line1\nloading\rDone\nline3')
    expect(result).toBe('line1\nDone\nline3')
  })

  it('normalizes CRLF to LF (not affected by overwrite logic)', () => {
    expect(cleanOutputForDisplay('line1\r\nline2')).toBe('line1\nline2')
  })

  it('expands tabs', () => {
    expect(cleanOutputForDisplay('col1\tcol2')).toBe('col1    col2')
  })

  it('filters blank lines', () => {
    expect(cleanOutputForDisplay('a\n\nb')).toBe('a\nb')
  })

  it('handles \\r followed by nothing (just moves cursor, no new content)', () => {
    // "text\r" — last segment after split is "", which is blank → filtered
    expect(cleanOutputForDisplay('text\r')).toBe('text')
  })
})

describe('buildDetailSummary', () => {
  it('extracts question from [Y/n] review prompt', () => {
    const raw = 'File checked\nWhich approach? [Y/n]'
    const { question, activityLines } = buildDetailSummary(raw)
    expect(question).toContain('[Y/n]')
    expect(activityLines).toContain('File checked')
  })

  it('extracts question from (y/N) pattern', () => {
    const { question } = buildDetailSummary('Continue? (y/N)')
    expect(question).toContain('(y/N)')
  })

  it('extracts question from waiting for input pattern', () => {
    const { question } = buildDetailSummary('Waiting for your input')
    expect(question).not.toBeNull()
  })

  it('returns null question when no review prompt present', () => {
    const { question, activityLines } = buildDetailSummary('line1\nline2')
    expect(question).toBeNull()
    expect(activityLines).toHaveLength(2)
  })

  it('filters noise lines (bare prompts, separators)', () => {
    const { activityLines } = buildDetailSummary('useful line\n> \n---\n$')
    expect(activityLines).toEqual(['useful line'])
  })

  it('caps activity lines at 10', () => {
    const raw = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n')
    const { activityLines } = buildDetailSummary(raw)
    expect(activityLines.length).toBeLessThanOrEqual(10)
    // Should keep the most recent lines
    expect(activityLines[activityLines.length - 1]).toBe('line20')
  })

  it('truncates question at 200 chars', () => {
    const longLine = 'approve ' + 'x'.repeat(250)
    const { question } = buildDetailSummary(longLine)
    expect(question!.length).toBeLessThanOrEqual(200)
  })

  it('handles empty input', () => {
    const { question, activityLines } = buildDetailSummary('')
    expect(question).toBeNull()
    expect(activityLines).toHaveLength(0)
  })
})
