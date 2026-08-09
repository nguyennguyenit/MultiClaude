// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ExecutionTrace } from '../execution-trace'
import type { ToolActivityGroup } from '@shared/types'

function makeMain(toolCount = 3): ToolActivityGroup {
  return {
    id: '__tools__',
    tokens: 100,
    toolCalls: Array.from({ length: toolCount }, (_, i) => ({
      id: `t${i}`,
      name: i % 2 === 0 ? 'Read' : 'Bash',
      tokens: 10
    }))
  }
}

describe('ExecutionTrace', () => {
  it('shows empty state when no trace', () => {
    render(<ExecutionTrace nodes={[]} />)
    expect(screen.getByTestId('exec-trace-empty')).toBeTruthy()
    expect(screen.getByTestId('exec-trace-empty').textContent).toMatch(/tool activity/i)
    expect(screen.getByTestId('exec-trace-empty').textContent).not.toMatch(/subagent/i)
  })

  it('labels the section Tool activity without claiming an execution trace', () => {
    render(<ExecutionTrace nodes={[makeMain()]} />)
    expect(screen.getByRole('heading').textContent).toMatch(/tool activity/i)
    expect(screen.queryByText(/execution trace/i)).toBeNull()
  })

  it('expands main node to reveal inner tool calls', () => {
    render(<ExecutionTrace nodes={[makeMain(2)]} />)
    const row = screen.getByTestId('exec-trace-node-__tools__')
    act(() => { fireEvent.click(row) })
    expect(screen.getByText('Read')).toBeTruthy()
    expect(screen.getByText('Bash')).toBeTruthy()
  })

  it('shows the observed total and omitted count when visible calls are capped', () => {
    const node: ToolActivityGroup = {
      ...makeMain(50),
      truncated: true,
      omittedCallCount: 12
    }
    render(<ExecutionTrace nodes={[node]} />)
    const row = screen.getByTestId('exec-trace-node-__tools__')
    expect(row.textContent).toMatch(/62 tool calls/i)
    act(() => { fireEvent.click(row) })
    expect(screen.getByText(/\+12 more/)).toBeTruthy()
  })
})
