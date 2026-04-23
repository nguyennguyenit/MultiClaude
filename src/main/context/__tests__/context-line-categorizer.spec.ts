import { describe, it, expect } from 'vitest'
import { categorizeLine, createToolUseRegistry } from '../context-line-categorizer'
import { ContextMentionDetector } from '../context-mention-detector'

function setup() {
  return {
    detector: new ContextMentionDetector(),
    registry: createToolUseRegistry()
  }
}

describe('categorizeLine', () => {
  it('routes user text (string form) to user-messages', () => {
    const { detector, registry } = setup()
    const hits = categorizeLine(
      { type: 'user', message: { role: 'user', content: 'hello claude' } },
      detector, registry
    )
    expect(hits).toHaveLength(1)
    expect(hits[0].category).toBe('user-messages')
  })

  it('routes user text containing <system-reminder> to claude-md', () => {
    const { detector, registry } = setup()
    const hits = categorizeLine(
      { type: 'user', message: { content: [{ type: 'text', text: '<system-reminder>hi</system-reminder>' }] } },
      detector, registry
    )
    expect(hits[0].category).toBe('claude-md')
  })

  it('routes assistant thinking → thinking-text', () => {
    const { detector, registry } = setup()
    const hits = categorizeLine(
      { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'pondering' }] } },
      detector, registry
    )
    expect(hits[0].category).toBe('thinking-text')
  })

  it('routes assistant text → thinking-text', () => {
    const { detector, registry } = setup()
    const hits = categorizeLine(
      { type: 'assistant', message: { content: [{ type: 'text', text: 'sure, doing it' }] } },
      detector, registry
    )
    expect(hits[0].category).toBe('thinking-text')
  })

  it('records tool_use and routes tool_result to tool-output by default', () => {
    const { detector, registry } = setup()
    categorizeLine(
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'id1', name: 'Bash', input: { command: 'ls' } }] } },
      detector, registry
    )
    const hits = categorizeLine(
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'id1', content: 'a b c' }] } },
      detector, registry
    )
    expect(hits[0].category).toBe('tool-output')
  })

  it('routes coord-tool uses and results to task-coordination', () => {
    const { detector, registry } = setup()
    const useHits = categorizeLine(
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'idT', name: 'TaskCreate', input: { description: 'x' } }] } },
      detector, registry
    )
    expect(useHits[0].category).toBe('task-coordination')
    const resHits = categorizeLine(
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'idT', content: 'ok' }] } },
      detector, registry
    )
    expect(resHits[0].category).toBe('task-coordination')
  })

  it('routes @mentioned Read results to mentioned-file', () => {
    const { detector, registry } = setup()
    categorizeLine(
      { type: 'user', message: { content: [{ type: 'text', text: 'read @src/foo.ts please' }] } },
      detector, registry
    )
    categorizeLine(
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'idR', name: 'Read', input: { file_path: '/p/src/foo.ts' } }] } },
      detector, registry
    )
    const hits = categorizeLine(
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'idR', content: 'file body' }] } },
      detector, registry
    )
    expect(hits[0].category).toBe('mentioned-file')
  })

  it('routes attachment lines (skill_listing etc.) to claude-md', () => {
    const { detector, registry } = setup()
    const hits = categorizeLine(
      { type: 'attachment', attachment: { type: 'skill_listing', content: 'very long listing' } },
      detector, registry
    )
    expect(hits[0].category).toBe('claude-md')
  })

  it('returns [] for unknown line types', () => {
    const { detector, registry } = setup()
    const hits = categorizeLine(
      { type: 'permission-mode' } as never,
      detector, registry
    )
    expect(hits).toEqual([])
  })
})
