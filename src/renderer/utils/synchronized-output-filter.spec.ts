import { describe, expect, it } from 'vitest'
import { SynchronizedOutputFilter } from './synchronized-output-filter'

const START = '\x1b[?2026h'
const END = '\x1b[?2026l'
const CLEAR = '\x1b[2J'

describe('SynchronizedOutputFilter', () => {
  it('passes ordinary output and clear-screen commands outside sync blocks', () => {
    const filter = new SynchronizedOutputFilter()

    expect(filter.process(`before${CLEAR}after`)).toBe(`before${CLEAR}after`)
  })

  it('strips only ED2 inside synchronized output blocks', () => {
    const filter = new SynchronizedOutputFilter()

    expect(filter.process(`before${START}frame${CLEAR}redraw${END}after`))
      .toBe(`before${START}frameredraw${END}after`)
  })

  it('tracks sync blocks and control sequences across PTY chunks', () => {
    const filter = new SynchronizedOutputFilter()

    expect(filter.process(`before${START.slice(0, 5)}`)).toBe('before')
    expect(filter.process(`${START.slice(5)}frame${CLEAR.slice(0, 2)}`))
      .toBe(`${START}frame`)
    expect(filter.process(`${CLEAR.slice(2)}redraw${END.slice(0, 4)}`)).toBe('redraw')
    expect(filter.process(`${END.slice(4)}after`)).toBe(`${END}after`)
  })

  it('preserves incomplete lookalikes once they stop matching', () => {
    const filter = new SynchronizedOutputFilter()

    expect(filter.process('\x1b[?202')).toBe('')
    expect(filter.process('5h text')).toBe('\x1b[?2025h text')
  })

  it('continues filtering through consecutive sync blocks', () => {
    const filter = new SynchronizedOutputFilter()

    expect(filter.process(`${START}${CLEAR}one${END}${START}two${CLEAR}${END}`))
      .toBe(`${START}one${END}${START}two${END}`)
  })
})
