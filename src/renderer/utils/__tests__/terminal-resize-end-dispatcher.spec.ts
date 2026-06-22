import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isAutoResizeRefreshSuppressed,
  resetResizeEndDispatcherForTests,
  suppressAutoResizeRefreshForTerminals,
} from '../terminal-resize-end-dispatcher'

describe('terminal-resize-end-dispatcher auto refresh suppression', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-16T00:00:00.000Z'))
    resetResizeEndDispatcherForTests()
  })

  afterEach(() => {
    resetResizeEndDispatcherForTests()
    vi.useRealTimers()
  })

  it('suppresses auto refresh for each remaining terminal during layout collapse', () => {
    suppressAutoResizeRefreshForTerminals(['term-a', 'term-b'], 1200)

    expect(isAutoResizeRefreshSuppressed('term-a')).toBe(true)
    expect(isAutoResizeRefreshSuppressed('term-b')).toBe(true)
    expect(isAutoResizeRefreshSuppressed('term-closed')).toBe(false)
  })
})
