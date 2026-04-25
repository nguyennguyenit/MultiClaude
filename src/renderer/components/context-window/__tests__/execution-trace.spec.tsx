// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ExecutionTrace } from '../execution-trace'
import type { TraceNode } from '@shared/types'

function makeMain(toolCount = 3): TraceNode {
  return {
    id: '__main__',
    agentType: 'main',
    agentName: 'main',
    tokens: 100,
    toolCalls: Array.from({ length: toolCount }, (_, i) => ({
      id: `t${i}`,
      name: i % 2 === 0 ? 'Read' : 'Bash',
      tokens: 10
    })),
    children: []
  }
}

function makeSub(name: string): TraceNode {
  return {
    id: `tu_${name}`,
    agentType: 'subagent',
    agentName: name,
    description: `run ${name}`,
    tokens: 200,
    toolCalls: [],
    children: []
  }
}

describe('ExecutionTrace', () => {
  it('shows empty state when no trace', () => {
    render(<ExecutionTrace nodes={[]} />)
    expect(screen.getByTestId('exec-trace-empty')).toBeTruthy()
  })

  it('renders one row per node with badge + tokens', () => {
    render(<ExecutionTrace nodes={[makeMain(), makeSub('tester'), makeSub('git-manager')]} />)
    expect(screen.getAllByTestId(/exec-trace-node-/).length).toBe(3)
    expect(screen.getByText('tester')).toBeTruthy()
    expect(screen.getByText('git-manager')).toBeTruthy()
  })

  it('expands main node to reveal inner tool calls', () => {
    render(<ExecutionTrace nodes={[makeMain(2)]} />)
    const row = screen.getByTestId('exec-trace-node-__main__')
    act(() => { fireEvent.click(row) })
    expect(screen.getByText('Read')).toBeTruthy()
    expect(screen.getByText('Bash')).toBeTruthy()
  })

  it('shows "+N more" when toolCalls were capped (depthCapped + deeperCount)', () => {
    const node: TraceNode = {
      ...makeMain(50),
      depthCapped: true,
      deeperCount: 12
    }
    render(<ExecutionTrace nodes={[node]} />)
    const row = screen.getByTestId('exec-trace-node-__main__')
    act(() => { fireEvent.click(row) })
    expect(screen.getByText(/\+12 more/)).toBeTruthy()
  })
})
