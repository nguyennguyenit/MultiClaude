// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createRef } from 'react'
import type { PaneTree } from '@shared/types'

vi.mock('./terminal-resize-handle', () => ({
  ResizeHandle: ({ direction }: { direction: string }) => (
    <div data-resize-handle="true" data-direction={direction} />
  )
}))

import { PaneTreeNode } from './pane-tree-node'

function leaf(id: string): PaneTree {
  return { kind: 'leaf', terminalId: id }
}
function row(a: PaneTree, b: PaneTree, ratio = 0.5): PaneTree {
  return { kind: 'split', orientation: 'row', ratio, children: [a, b] }
}
function col(a: PaneTree, b: PaneTree, ratio = 0.5): PaneTree {
  return { kind: 'split', orientation: 'column', ratio, children: [a, b] }
}

function defaultProps() {
  return {
    path: [] as number[],
    activeTerminalId: null as string | null,
    onSetRatio: () => {}
  }
}

describe('<PaneTreeNode>', () => {
  it('renders an empty leaf slot div with data-pane-leaf', () => {
    render(<PaneTreeNode node={leaf('t1')} {...defaultProps()} />)
    const el = document.querySelector('[data-pane-leaf="t1"]')
    expect(el).toBeTruthy()
  })

  it('renders two leaf slots + one vertical handle for a row split', () => {
    render(<PaneTreeNode node={row(leaf('a'), leaf('b'))} {...defaultProps()} />)
    expect(document.querySelectorAll('[data-pane-leaf]').length).toBe(2)
    const handles = document.querySelectorAll('[data-resize-handle="true"]')
    expect(handles.length).toBe(1)
    expect(handles[0].getAttribute('data-direction')).toBe('vertical')
  })

  it('renders a horizontal handle for a column split', () => {
    render(<PaneTreeNode node={col(leaf('a'), leaf('b'))} {...defaultProps()} />)
    const handles = document.querySelectorAll('[data-resize-handle="true"]')
    expect(handles[0].getAttribute('data-direction')).toBe('horizontal')
  })

  it('renders all leaf slots and 2 handles for nested split', () => {
    const tree = row(leaf('a'), col(leaf('b'), leaf('c')))
    render(<PaneTreeNode node={tree} {...defaultProps()} />)
    expect(document.querySelectorAll('[data-pane-leaf]').length).toBe(3)
    expect(document.querySelectorAll('[data-resize-handle="true"]').length).toBe(2)
  })

  it('applies ratio to the first child flex basis', () => {
    const ref = createRef<HTMLDivElement>()
    const { container } = render(
      <div ref={ref} style={{ width: 200, height: 100 }}>
        <PaneTreeNode node={row(leaf('a'), leaf('b'), 0.25)} {...defaultProps()} />
      </div>
    )
    const flexChildren = container.querySelectorAll('[data-pane-child]')
    expect(flexChildren.length).toBe(2)
    // first child flex = ratio, second = 1 - ratio
    expect(Number((flexChildren[0] as HTMLElement).style.flexGrow)).toBeCloseTo(0.25)
    expect(Number((flexChildren[1] as HTMLElement).style.flexGrow)).toBeCloseTo(0.75)
  })
})
