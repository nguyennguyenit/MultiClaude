import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { JsonStreamParser } from '../json-stream-parser'
import { PlainTextParser } from '../plain-text-parser'
import { OutputParser } from '../output-parser'
import type { TaskEvent } from '@shared/types'

// Fixture captures two PTY chunks that would be emitted during a SIGWINCH redraw.
// After cleanTerminalOutput() strips ANSI, the two chunks collapse to identical
// plain text — which is exactly the signal content-hash dedup uses.
const __filename = fileURLToPath(import.meta.url)
const __testDirname = path.dirname(__filename)
const REDRAW_FIXTURE_PATH = path.resolve(__testDirname, 'fixtures/redraw-sample.txt')

function loadRedrawChunks(): [string, string] {
  const raw = fs.readFileSync(REDRAW_FIXTURE_PATH, 'utf-8')
  const parts = raw.split('<<<FIXTURE-CHUNK-BOUNDARY>>>')
  // parts[0] is header comments; we want the two chunks that follow.
  const chunks = parts
    .slice(1)
    .map(s => s.replace(/^\r?\n/, '').replace(/\r?\n$/, '').replace(/\\x1b/g, '\x1b'))
  if (chunks.length < 2) throw new Error('redraw-sample.txt is missing chunks')
  return [chunks[0], chunks[1]]
}

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

  describe('non-review lines', () => {
    it('ignores completed task lines for Claude because completion events come from JSONL', () => {
      parser.parse('term1', '✓ Fixed the login bug', 'TestProject', 'claude')

      expect(events).toHaveLength(0)
    })

    it('ignores failure lines for Claude because failure events come from JSONL', () => {
      parser.parse('term1', 'Process exited with code 1', 'Proj', 'claude')

      expect(events).toHaveLength(0)
    })

    it('emits taskComplete for non-Claude agents from plain text output', () => {
      parser.parse('term1', '✓ Fixed the login bug', 'TestProject', 'codex')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskComplete')
      expect(events[0].taskName).toBe('Fixed the login bug')
    })

    it('emits taskFailed for non-Claude agents from plain text output', () => {
      parser.parse('term1', 'Process exited with code 1', 'Proj', 'gemini')

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

    it('detects "Do you want to proceed?" prompt', () => {
      parser.parse('term1', 'Do you want to proceed?', 'Proj')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('reviewNeeded')
    })
  })

  describe('Dedup', () => {
    it('suppresses an identical approval prompt emitted twice in quick succession (hash path)', () => {
      parser.parse('term1', 'Allow `bash` to run the command? [Y/n]', 'Proj')
      parser.parse('term1', 'Allow `bash` to run the command? [Y/n]', 'Proj')

      expect(events).toHaveLength(1) // Second hit blocked by content-hash dedup
    })
  })

  describe('project name propagation', () => {
    it('uses provided projectName in emitted event', () => {
      const parser = new PlainTextParser()
      const events: TaskEvent[] = []
      parser.on('taskEvent', (e: TaskEvent) => events.push(e))
      parser.parse('term1', 'Allow tool to run? [Y/n]', 'MyProject')
      expect(events[0].projectName).toBe('MyProject')
    })
  })

  describe('context extraction', () => {
    let parser: PlainTextParser
    let events: TaskEvent[]

    beforeEach(() => {
      parser = new PlainTextParser()
      events = []
      parser.on('taskEvent', (e: TaskEvent) => events.push(e))
    })

    it('extracts tool name from "Allow `bash` to run" pattern', () => {
      parser.parse('term1', 'Allow `bash` to run the command?\n[Y/n]', 'Proj')
      expect(events[0].taskName).toBe('bash requires approval')
    })

    it('extracts tool name from "Allow npm to run" without backticks', () => {
      parser.parse('term1', 'Allow npm to run scripts?\n[Y/n]', 'Proj')
      expect(events[0].taskName).toBe('npm requires approval')
    })

    it('uses last meaningful line as fallback when no tool pattern found', () => {
      parser.parse('term1', 'Running lint check\nSome important context\n[Y/n]', 'Proj')
      expect(events[0].taskName).toBe('Some important context')
    })

    it('falls back to "Waiting for approval" when only the prompt line is present', () => {
      parser.parse('term1', '[Y/n]', 'Proj')
      expect(events[0].taskName).toBe('Waiting for approval')
    })

    it('uses buffer from previous parse calls for context extraction', () => {
      // First chunk: neutral context (no review pattern match, no emit)
      parser.parse('term1', 'Running npm install in /project', 'Proj')
      expect(events).toHaveLength(0)

      // Second chunk: the actual prompt. Buffer still carries the prior line as
      // fallback context since no tool-approval phrasing precedes the prompt.
      parser.parse('term1', '[Y/n]', 'Proj')
      expect(events).toHaveLength(1)
      expect(events[0].taskName).toBe('Running npm install in /project')
    })

    it('does not bleed buffer between different terminals', () => {
      // Seed term1 with neutral context; must not emit and must not leak to term2.
      parser.parse('term1', 'Running something in /foo', 'Proj')
      expect(events).toHaveLength(0)
      // term2 gets [Y/n] with no prior buffer
      parser.parse('term2', '[Y/n]', 'Proj')
      expect(events).toHaveLength(1)
      expect(events[0].taskName).toBe('Waiting for approval')
    })
  })

  // ---------------------------------------------------------------------------
  // Phase-02 TDD contract (see plans/20260417-1850-fix-review-needed-false-trigger).
  //
  // Hash contract documented here for future maintainers:
  //   - Input:  `${taskName}|${firstMatchedPromptLine}` where firstMatchedPromptLine
  //             is the first line inside the cleaned data satisfying REVIEW_PATTERN.
  //   - Algo:   SHA-1, hex, truncated to first 16 chars (deterministic, stdlib,
  //             collision-irrelevant at this scope).
  //   - TTL:    60_000 ms (HASH_TTL_MS in plain-text-parser.ts).
  // ---------------------------------------------------------------------------
  describe('false-trigger prevention (content-hash + tightened pattern)', () => {
    let freshParser: PlainTextParser
    let freshEvents: TaskEvent[]

    beforeEach(() => {
      freshParser = new PlainTextParser()
      freshEvents = []
      freshParser.on('taskEvent', (e: TaskEvent) => freshEvents.push(e))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('redraw dedup via content hash', () => {
      it('does NOT fire a second event when the same approval prompt is re-emitted (redraw past 5s)', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
        freshParser.parse('term1', 'Allow `bash` to run the command?\n[Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(1)

        // Advance past the legacy 5s time-debounce so that the hash is the only thing
        // that can suppress the duplicate. On the old code path this fires again.
        vi.setSystemTime(1_010_000)
        freshParser.parse('term1', 'Allow `bash` to run the command?\n[Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(1)
      })

      it('collapses a reverse-order redraw (tool line after [Y/n]) — hash stable via TOOL_APPROVAL preference', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
        // First chunk: body before prompt (natural order).
        freshParser.parse('term1', 'Allow `bash` to run the command?\nnpm test\n[Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(1)

        // Second chunk (past 5s): same cleaned content but written `[Y/n]` first,
        // body after — simulating an ANSI-positioned redraw whose write order is
        // reversed from render order.
        vi.setSystemTime(1_008_000)
        freshParser.parse('term1', '[Y/n]\nAllow `bash` to run the command?\nnpm test', 'Proj')
        expect(freshEvents).toHaveLength(1) // tool-line-preference keeps the hash stable
      })

      it('collapses the fixture redraw chunks to a single event (different ANSI wrapping, same cleaned text)', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
        const [chunk1, chunk2] = loadRedrawChunks()

        freshParser.parse('term1', chunk1, 'Proj')
        vi.setSystemTime(1_008_000)
        freshParser.parse('term1', chunk2, 'Proj')

        expect(freshEvents).toHaveLength(1)
      })

      it('fires a second event when a DIFFERENT approval (different tool name) arrives within 60s', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
        freshParser.parse('term1', 'Allow `bash` to run the command?\n[Y/n]', 'Proj')
        vi.setSystemTime(1_010_000)
        freshParser.parse('term1', 'Allow `git` to run the command?\n[Y/n]', 'Proj')

        expect(freshEvents).toHaveLength(2)
        expect(freshEvents[0].taskName).toBe('bash requires approval')
        expect(freshEvents[1].taskName).toBe('git requires approval')
      })

      it('fires again once the 60s hash TTL has elapsed for the same prompt', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
        freshParser.parse('term1', 'Allow `bash` to run?\n[Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(1)

        vi.setSystemTime(1_000_000 + 61_000)
        freshParser.parse('term1', 'Allow `bash` to run?\n[Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(2)
      })
    })

    describe('tightened REVIEW_PATTERN', () => {
      it('does NOT match a bare `approve` keyword buried in prose', () => {
        freshParser.parse('term1', 'I approve of this design choice for now.', 'Proj')
        expect(freshEvents).toHaveLength(0)
      })

      it('does NOT match `waiting for your input` outside an approval context', () => {
        freshParser.parse('term1', 'The server is waiting for your input on port 3000', 'Proj')
        expect(freshEvents).toHaveLength(0)
      })

      it('does NOT match the legacy loose `allow this tool` phrasing on its own', () => {
        // Old pattern matched bare "allow this tool"; new pattern requires a tool token.
        freshParser.parse('term1', 'You can always allow this tool later if needed.', 'Proj')
        expect(freshEvents).toHaveLength(0)
      })

      it('matches [Y/n] prompt', () => {
        freshParser.parse('term1', 'Proceed? [Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(1)
      })

      it('matches (y/N) prompt', () => {
        freshParser.parse('term1', 'Are you sure? (y/N)', 'Proj')
        expect(freshEvents).toHaveLength(1)
      })

      it('matches "Do you want to proceed?" form', () => {
        freshParser.parse('term1', 'Do you want to proceed with this change?', 'Proj')
        expect(freshEvents).toHaveLength(1)
      })

      it('matches "Do you want to continue?" form', () => {
        freshParser.parse('term1', 'Do you want to continue?', 'Proj')
        expect(freshEvents).toHaveLength(1)
      })

      it('matches "Allow bash to run" tool-approval form (no backticks)', () => {
        freshParser.parse('term1', 'Allow bash to run the command', 'Proj')
        expect(freshEvents).toHaveLength(1)
      })

      it('matches "Allow `git` to execute" backtick tool-approval form', () => {
        freshParser.parse('term1', 'Allow `git` to execute this command', 'Proj')
        expect(freshEvents).toHaveLength(1)
      })
    })

    describe('terminal isolation', () => {
      it('does not bleed the hash map across terminalIds', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
        freshParser.parse('term1', 'Allow `bash` to run?\n[Y/n]', 'Proj')
        vi.setSystemTime(1_010_000)
        freshParser.parse('term2', 'Allow `bash` to run?\n[Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(2)
      })

      it('clearTerminal removes the hash entry so the next identical prompt fires again', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
        freshParser.parse('term1', 'Allow `bash` to run?\n[Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(1)

        freshParser.clearTerminal('term1')

        vi.setSystemTime(1_010_000)
        freshParser.parse('term1', 'Allow `bash` to run?\n[Y/n]', 'Proj')
        expect(freshEvents).toHaveLength(2)
      })
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
      parser.parse('term1', 'Allow this tool? [Y/n]', 'Proj', 'codex')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('reviewNeeded')
    })

    it('uses text parser taskComplete detection for non-Claude agents in plain-text mode', () => {
      parser.setMode('plain-text')
      parser.parse('term1', '✓ Ship the patch', 'Proj', 'codex')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('taskComplete')
      expect(events[0].taskName).toBe('Ship the patch')
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
