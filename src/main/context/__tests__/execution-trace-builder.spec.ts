import { describe, it, expect } from 'vitest'
import { ExecutionTraceBuilder } from '../execution-trace-builder'

describe('ExecutionTraceBuilder', () => {
  it('returns empty array when no tool_use blocks observed', () => {
    const b = new ExecutionTraceBuilder()
    b.recordAssistantBlocks([{ type: 'text', text: 'hi' }])
    expect(b.snapshot()).toEqual([])
  })

  it('groups non-Agent tool calls under a single main node', () => {
    const b = new ExecutionTraceBuilder()
    b.recordAssistantBlocks([
      { type: 'tool_use', id: 'tu_1', name: 'Read', input: { path: '/a' } },
      { type: 'tool_use', id: 'tu_2', name: 'Bash', input: { command: 'ls' } }
    ])
    b.recordToolResults([
      { tool_use_id: 'tu_1', content: 'file content' },
      { tool_use_id: 'tu_2', content: 'output' }
    ])
    const trace = b.snapshot()
    expect(trace.length).toBe(1)
    expect(trace[0].agentType).toBe('main')
    expect(trace[0].toolCalls.length).toBe(2)
    expect(trace[0].toolCalls[0].name).toBe('Read')
    expect(trace[0].tokens).toBeGreaterThan(0)
  })

  it('emits a subagent node per Agent tool_use', () => {
    const b = new ExecutionTraceBuilder()
    b.recordAssistantBlocks([
      {
        type: 'tool_use',
        id: 'tu_a1',
        name: 'Agent',
        input: { subagent_type: 'git-manager', description: 'commit', prompt: 'do it' }
      },
      {
        type: 'tool_use',
        id: 'tu_a2',
        name: 'Agent',
        input: { subagent_type: 'researcher', description: 'find docs', prompt: 'search X' }
      }
    ])
    b.recordToolResults([
      { tool_use_id: 'tu_a1', content: 'agent output 1' },
      { tool_use_id: 'tu_a2', content: 'agent output 2' }
    ])
    const trace = b.snapshot()
    expect(trace.length).toBe(2)
    expect(trace[0].agentType).toBe('subagent')
    expect(trace[0].agentName).toBe('git-manager')
    expect(trace[0].description).toBe('commit')
    expect(trace[1].agentName).toBe('researcher')
  })

  it('mixes main + subagent nodes when both kinds observed', () => {
    const b = new ExecutionTraceBuilder()
    b.recordAssistantBlocks([
      { type: 'tool_use', id: 'tu_r', name: 'Read', input: {} },
      {
        type: 'tool_use',
        id: 'tu_a',
        name: 'Agent',
        input: { subagent_type: 'tester' }
      }
    ])
    b.recordToolResults([
      { tool_use_id: 'tu_r', content: 'x' },
      { tool_use_id: 'tu_a', content: 'subagent done' }
    ])
    const trace = b.snapshot()
    expect(trace.length).toBe(2)
    expect(trace.find((n) => n.agentType === 'main')).toBeDefined()
    expect(trace.find((n) => n.agentType === 'subagent')).toBeDefined()
  })

  it('ignores tool_result with no matching tool_use (orphan)', () => {
    const b = new ExecutionTraceBuilder()
    b.recordToolResults([{ tool_use_id: 'unknown', content: 'orphan' }])
    expect(b.snapshot()).toEqual([])
  })

  it('caps inner toolCalls at 50 with deeperCount', () => {
    const b = new ExecutionTraceBuilder()
    const blocks = []
    for (let i = 0; i < 70; i++) {
      blocks.push({ type: 'tool_use', id: `t${i}`, name: 'Read', input: {} })
    }
    b.recordAssistantBlocks(blocks)
    const trace = b.snapshot()
    expect(trace[0].toolCalls.length).toBe(50)
    expect(trace[0].depthCapped).toBe(true)
    expect(trace[0].deeperCount).toBe(20)
  })

  it('snapshot returns a defensive copy (subsequent records do not mutate prior snapshots)', () => {
    const b = new ExecutionTraceBuilder()
    b.recordAssistantBlocks([{ type: 'tool_use', id: 't1', name: 'Read', input: {} }])
    const s1 = b.snapshot()
    b.recordAssistantBlocks([{ type: 'tool_use', id: 't2', name: 'Bash', input: {} }])
    expect(s1[0].toolCalls.length).toBe(1)
    const s2 = b.snapshot()
    expect(s2[0].toolCalls.length).toBe(2)
  })
})
