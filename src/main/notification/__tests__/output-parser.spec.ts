import { describe, it, expect, beforeEach } from 'vitest'
import { JsonStreamParser } from '../json-stream-parser'
import { PlainTextParser } from '../plain-text-parser'
import { OutputParser } from '../output-parser'
import type { TaskEvent } from '@shared/types'

describe('JsonStreamParser', () => {
  let parser: JsonStreamParser
  let events: TaskEvent[]

  beforeEach(() => {
    parser = new JsonStreamParser()
    events = []
    parser.on('taskEvent', (e: TaskEvent) => events.push(e))
  })

  describe('TodoWrite detection', () => {
    it('emits taskComplete for newly completed todos', () => {
      const json = JSON.stringify({
        type: 'tool_use',
        tool_name: 'TodoWrite',
        input: {
          todos: [
            { content: 'Fix login bug', status: 'completed' },
            { content: 'Add tests', status: 'pending' }
          ]
        }
      })
      parser.parse('term1', json + '\n', 'TestProject')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskComplete')
      expect(events[0].taskName).toBe('Fix login bug')
      expect(events[0].projectName).toBe('TestProject')
      expect(events[0].id).toHaveLength(16)
    })

    it('tracks already completed todos to avoid duplicates', () => {
      const json1 = JSON.stringify({
        type: 'tool_use',
        tool_name: 'TodoWrite',
        input: { todos: [{ content: 'Task A', status: 'completed' }] }
      })
      const json2 = JSON.stringify({
        type: 'tool_use',
        tool_name: 'TodoWrite',
        input: { todos: [{ content: 'Task A', status: 'completed' }, { content: 'Task B', status: 'completed' }] }
      })

      parser.parse('term1', json1 + '\n', 'Proj')
      parser.parse('term1', json2 + '\n', 'Proj')

      expect(events).toHaveLength(2) // Task A once, Task B once
      expect(events.map(e => e.taskName)).toEqual(['Task A', 'Task B'])
    })
  })

  describe('Error detection', () => {
    it('emits taskFailed for tool_result with is_error', () => {
      const json = JSON.stringify({
        type: 'tool_result',
        is_error: true,
        content: 'Command failed: npm test'
      })
      parser.parse('term1', json + '\n', 'TestProject')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskFailed')
      expect(events[0].taskName).toBe('Command failed: npm test')
    })

    it('emits taskFailed for error event type', () => {
      const json = JSON.stringify({
        type: 'error',
        content: 'Unexpected error occurred'
      })
      parser.parse('term1', json + '\n', 'TestProject')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskFailed')
    })
  })

  describe('Review detection', () => {
    it('emits reviewNeeded for AskUserQuestion', () => {
      const json = JSON.stringify({
        type: 'tool_use',
        tool_name: 'AskUserQuestion',
        input: { question: 'Which database to use?' }
      })
      parser.parse('term1', json + '\n', 'TestProject')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('reviewNeeded')
      expect(events[0].taskName).toBe('Which database to use?')
    })
  })

  describe('Buffer handling', () => {
    it('handles incomplete JSON lines across chunks', () => {
      const json = JSON.stringify({ type: 'error', content: 'Test' })
      const half1 = json.slice(0, 20)
      const half2 = json.slice(20) + '\n'

      parser.parse('term1', half1, 'Proj')
      expect(events).toHaveLength(0) // Waiting for complete line

      parser.parse('term1', half2, 'Proj')
      expect(events).toHaveLength(1)
    })

    it('clears terminal state on clearTerminal', () => {
      parser.parse('term1', '{"type":"error","content":"x"}\n', 'P')
      parser.clearTerminal('term1')
      // Should not throw, internal state cleared
      expect(events).toHaveLength(1)
    })
  })

  describe('Input validation', () => {
    it('handles invalid todos array gracefully', () => {
      const json = JSON.stringify({
        type: 'tool_use',
        tool_name: 'TodoWrite',
        input: { todos: 'not an array' }
      })
      parser.parse('term1', json + '\n', 'Proj')
      expect(events).toHaveLength(0) // No crash, no event
    })

    it('handles malformed todo objects gracefully', () => {
      const json = JSON.stringify({
        type: 'tool_use',
        tool_name: 'TodoWrite',
        input: {
          todos: [
            { content: 'Valid task', status: 'completed' },
            { invalid: 'object' },
            null,
            { content: 123, status: 'completed' }
          ]
        }
      })
      parser.parse('term1', json + '\n', 'Proj')
      expect(events).toHaveLength(1) // Only valid task emitted
      expect(events[0].taskName).toBe('Valid task')
    })
  })

  describe('Cleanup', () => {
    it('cleanup does not throw on empty parser', () => {
      expect(() => parser.cleanup()).not.toThrow()
    })
  })
})

describe('PlainTextParser', () => {
  let parser: PlainTextParser
  let events: TaskEvent[]

  beforeEach(() => {
    parser = new PlainTextParser()
    events = []
    parser.on('taskEvent', (e: TaskEvent) => events.push(e))
  })

  describe('Task completion detection', () => {
    it('extracts task name from checkmark pattern', () => {
      parser.parse('term1', '✓ Fixed the login bug', 'TestProject')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskComplete')
      expect(events[0].taskName).toBe('Fixed the login bug')
    })

    it('handles completed suffix', () => {
      parser.parse('term1', '✓ Build process (completed)', 'Proj')

      expect(events).toHaveLength(1)
      expect(events[0].taskName).toBe('Build process')
    })
  })

  describe('Task failure detection', () => {
    it('extracts task name from X pattern', () => {
      parser.parse('term1', '✗ Database migration failed', 'TestProject')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskFailed')
      expect(events[0].taskName).toBe('Database migration failed')
    })

    it('extracts exit code', () => {
      parser.parse('term1', 'Process exited with code 1', 'Proj')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskFailed')
      expect(events[0].taskName).toBe('Exit code 1')
    })
  })

  describe('Review detection', () => {
    it('detects Y/n prompt', () => {
      parser.parse('term1', 'Allow this tool? [Y/n]', 'Proj')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('reviewNeeded')
    })

    it('detects approval prompt', () => {
      parser.parse('term1', 'waiting for your confirmation', 'Proj')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('reviewNeeded')
    })
  })

  describe('Debouncing', () => {
    it('debounces same event type within 5 seconds', () => {
      parser.parse('term1', '✓ Task done', 'Proj')
      parser.parse('term1', '✓ Task done again', 'Proj')

      expect(events).toHaveLength(1) // Second ignored due to debounce
    })
  })
})

describe('OutputParser', () => {
  let parser: OutputParser
  let events: TaskEvent[]

  beforeEach(() => {
    parser = new OutputParser()
    events = []
    parser.on('taskEvent', (e: TaskEvent) => events.push(e))
  })

  describe('Mode selection', () => {
    it('uses JSON parser in stream-json mode', () => {
      parser.setMode('stream-json')
      parser.parse('term1', '{"type":"error","content":"test"}\n', 'Proj')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskFailed')
    })

    it('uses text parser in plain-text mode', () => {
      parser.setMode('plain-text')
      parser.parse('term1', '✓ Task completed', 'Proj')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskComplete')
    })
  })

  describe('Auto-detection with locking', () => {
    it('locks to JSON on first JSON detection', () => {
      parser.setMode('auto')
      parser.parse('term1', '{"type":"error","content":"x"}\n', 'P')

      expect(parser.getTerminalParserType('term1')).toBe('json')
      expect(events).toHaveLength(1)
    })

    it('locks to text on non-JSON content', () => {
      parser.setMode('auto')
      parser.parse('term1', '✓ Done', 'P')

      expect(parser.getTerminalParserType('term1')).toBe('text')
    })

    it('uses locked parser for subsequent calls', () => {
      parser.setMode('auto')
      parser.parse('term1', '{"type":"error","content":"x"}\n', 'P')
      parser.parse('term1', '✓ Task', 'P') // Should use JSON parser, not text

      expect(events).toHaveLength(1) // Only JSON error, text pattern ignored by JSON parser
    })

    it('clears lock on clearTerminal', () => {
      parser.setMode('auto')
      parser.parse('term1', '{"type":"error","content":"x"}\n', 'P')
      parser.clearTerminal('term1')

      expect(parser.getTerminalParserType('term1')).toBeUndefined()
    })
  })

  describe('Cleanup', () => {
    it('cleanup does not throw on empty parser', () => {
      expect(() => parser.cleanup()).not.toThrow()
    })

    it('cleanup clears child parser state', () => {
      parser.setMode('auto')
      parser.parse('term1', '{"type":"error","content":"x"}\n', 'P')
      parser.parse('term2', '✓ Done', 'P')
      expect(() => parser.cleanup()).not.toThrow()
    })
  })
})
