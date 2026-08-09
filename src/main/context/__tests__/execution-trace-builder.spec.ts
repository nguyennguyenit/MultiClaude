import { describe, it, expect } from 'vitest'
import { ExecutionTraceBuilder } from '../execution-trace-builder'

describe('ExecutionTraceBuilder', () => {
  it('returns empty array when no tool_use blocks observed', () => {
    const b = new ExecutionTraceBuilder()
    b.recordAssistantBlocks([{ type: 'text', text: 'hi' }])
    expect(b.snapshot()).toEqual([])
  })

  it('groups tool calls under a single flat activity node', () => {
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
    expect(trace[0].toolCalls.length).toBe(2)
    expect(trace[0].toolCalls[0].name).toBe('Read')
    expect(trace[0].tokens).toBeGreaterThan(0)
  })

  it('records Agent invocations as tool activity without claiming a nested trace', () => {
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
    const beforeResults = b.snapshot()[0].toolCalls.map((call) => call.tokens)
    b.recordToolResults([
      { tool_use_id: 'tu_a1', content: 'agent output 1' },
      { tool_use_id: 'tu_a2', content: 'agent output 2' }
    ])
    const trace = b.snapshot()
    expect(trace.length).toBe(1)
    expect(trace[0].toolCalls.map((call) => call.name)).toEqual(['Agent', 'Agent'])
    expect(trace[0].toolCalls.every((call, index) => call.tokens > beforeResults[index])).toBe(true)
    expect(trace[0]).not.toHaveProperty('children')
    expect(trace[0]).not.toHaveProperty('agentType')
  })

  it('keeps ordinary and Agent calls in invocation order in one activity group', () => {
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
    expect(trace.length).toBe(1)
    expect(trace[0].toolCalls.map((call) => call.name)).toEqual(['Read', 'Agent'])
  })

  it('ignores tool_result with no matching tool_use (orphan)', () => {
    const b = new ExecutionTraceBuilder()
    b.recordToolResults([{ tool_use_id: 'unknown', content: 'orphan' }])
    expect(b.snapshot()).toEqual([])
  })

  it('caps visible calls at 50 while retaining aggregate input tokens and omitted count', () => {
    const b = new ExecutionTraceBuilder()
    const blocks = []
    for (let i = 0; i < 70; i++) {
      blocks.push({ type: 'tool_use', id: `t${i}`, name: 'Read', input: { path: `/file/${i}` } })
    }
    b.recordAssistantBlocks(blocks)
    const trace = b.snapshot()
    const aggregateBeforeResults = trace[0].tokens
    const visibleInputTotal = trace[0].toolCalls.reduce((total, call) => total + call.tokens, 0)
    expect(trace[0].toolCalls.length).toBe(50)
    expect(trace[0].truncated).toBe(true)
    expect(trace[0].omittedCallCount).toBe(20)
    expect(aggregateBeforeResults).toBeGreaterThan(visibleInputTotal)

    b.recordToolResults([{ tool_use_id: 't69', content: 'result from omitted call' }])
    expect(b.snapshot()[0].tokens).toBeGreaterThan(aggregateBeforeResults)
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
