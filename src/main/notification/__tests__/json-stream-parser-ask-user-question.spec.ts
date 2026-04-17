import { describe, it, expect, beforeEach } from 'vitest'
import { JsonStreamParser } from '../json-stream-parser'
import type { TaskEvent } from '@shared/types/notification-events'

describe('JsonStreamParser — AskUserQuestion preservation', () => {
  let parser: JsonStreamParser
  let events: TaskEvent[]

  beforeEach(() => {
    parser = new JsonStreamParser()
    events = []
    parser.on('taskEvent', (e: TaskEvent) => events.push(e))
  })

  it('preserves question text, header, multiSelect, and options in TaskEvent.question', () => {
    const json = JSON.stringify({
      type: 'tool_use',
      tool_name: 'AskUserQuestion',
      input: {
        question: 'Which database to use?',
        header: 'Database selection',
        multiSelect: false,
        options: [
          { label: 'Postgres', description: 'Relational, SQL' },
          { label: 'MongoDB', description: 'Document-oriented' },
          { label: 'SQLite', description: 'Embedded' }
        ]
      }
    })
    parser.parse('term1', json + '\n', 'TestProject')

    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.type).toBe('reviewNeeded')
    expect(ev.taskName).toBe('Which database to use?')
    expect(ev.question).toBeDefined()
    expect(ev.question!.text).toBe('Which database to use?')
    expect(ev.question!.header).toBe('Database selection')
    expect(ev.question!.multiSelect).toBe(false)
    expect(ev.question!.options).toEqual([
      { label: 'Postgres', description: 'Relational, SQL' },
      { label: 'MongoDB', description: 'Document-oriented' },
      { label: 'SQLite', description: 'Embedded' }
    ])
  })

  it('defaults multiSelect=false when missing', () => {
    const json = JSON.stringify({
      type: 'tool_use',
      tool_name: 'AskUserQuestion',
      input: {
        question: 'Pick one',
        options: [{ label: 'A' }, { label: 'B' }]
      }
    })
    parser.parse('term1', json + '\n', 'P')

    expect(events[0].question!.multiSelect).toBe(false)
  })

  it('carries multiSelect=true through verbatim', () => {
    const json = JSON.stringify({
      type: 'tool_use',
      tool_name: 'AskUserQuestion',
      input: {
        question: 'Select features',
        multiSelect: true,
        options: [{ label: 'A' }, { label: 'B' }]
      }
    })
    parser.parse('term1', json + '\n', 'P')

    expect(events[0].question!.multiSelect).toBe(true)
  })

  it('omits question field when tool_use has no options (no options → no buttons)', () => {
    const json = JSON.stringify({
      type: 'tool_use',
      tool_name: 'AskUserQuestion',
      input: { question: 'Free-form reply please' }
    })
    parser.parse('term1', json + '\n', 'P')

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('reviewNeeded')
    expect(events[0].question).toBeUndefined()
  })

  it('drops non-array options silently and emits no question payload', () => {
    const json = JSON.stringify({
      type: 'tool_use',
      tool_name: 'AskUserQuestion',
      input: { question: 'Oops', options: 'not an array' }
    })
    parser.parse('term1', json + '\n', 'P')

    expect(events).toHaveLength(1)
    expect(events[0].question).toBeUndefined()
  })

  it('filters invalid option entries (missing label)', () => {
    const json = JSON.stringify({
      type: 'tool_use',
      tool_name: 'AskUserQuestion',
      input: {
        question: 'Pick',
        options: [
          { label: 'Good' },
          { description: 'no label' },
          { label: 42 },
          { label: 'Also good', description: 'ok' }
        ]
      }
    })
    parser.parse('term1', json + '\n', 'P')

    expect(events[0].question!.options).toEqual([
      { label: 'Good' },
      { label: 'Also good', description: 'ok' }
    ])
  })

  it('falls back to "Input needed" when question text missing but options present', () => {
    const json = JSON.stringify({
      type: 'tool_use',
      tool_name: 'AskUserQuestion',
      input: { options: [{ label: 'Yes' }, { label: 'No' }] }
    })
    parser.parse('term1', json + '\n', 'P')

    expect(events).toHaveLength(1)
    expect(events[0].taskName).toBe('Input needed')
    expect(events[0].question!.text).toBe('Input needed')
    expect(events[0].question!.options).toHaveLength(2)
  })
})
