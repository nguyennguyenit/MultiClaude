// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SplitButton } from './split-button'
import { useContextMenuStore } from '../../stores/context-menu-store'

describe('<SplitButton>', () => {
  beforeEach(() => {
    useContextMenuStore.getState().closeMenu()
  })

  it('renders the + and ▾ zones', () => {
    render(
      <SplitButton atLimit={false} splitDisabled={false} terminalLimit={4}
        onAddTerminal={() => {}} onSplit={() => {}} />
    )
    expect(screen.getByLabelText('New Terminal')).toBeTruthy()
    expect(screen.getByLabelText('Split terminal options')).toBeTruthy()
  })

  it('+ click calls onAddTerminal', () => {
    const onAdd = vi.fn()
    render(
      <SplitButton atLimit={false} splitDisabled={false} terminalLimit={4}
        onAddTerminal={onAdd} onSplit={() => {}} />
    )
    fireEvent.click(screen.getByLabelText('New Terminal'))
    expect(onAdd).toHaveBeenCalled()
  })

  it('▾ opens a context menu with 4 split items', () => {
    const onSplit = vi.fn()
    render(
      <SplitButton atLimit={false} splitDisabled={false} terminalLimit={4}
        onAddTerminal={() => {}} onSplit={onSplit} />
    )
    act(() => {
      fireEvent.click(screen.getByLabelText('Split terminal options'))
    })
    const state = useContextMenuStore.getState()
    expect(state.open).toBe(true)
    expect(state.items.map((i) => i.id)).toEqual(['split-right', 'split-left', 'split-down', 'split-up'])
    state.items[0].onSelect?.()
    expect(onSplit).toHaveBeenCalledWith('right')
  })

  it('both zones disabled when atLimit', () => {
    render(
      <SplitButton atLimit={true} splitDisabled={true} terminalLimit={2}
        onAddTerminal={() => {}} onSplit={() => {}} />
    )
    expect((screen.getByLabelText('New Terminal') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Split terminal options') as HTMLButtonElement).disabled).toBe(true)
  })

  it('▾ disabled when splitDisabled and + still enabled', () => {
    render(
      <SplitButton atLimit={false} splitDisabled={true} terminalLimit={4}
        onAddTerminal={() => {}} onSplit={() => {}} />
    )
    expect((screen.getByLabelText('New Terminal') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('Split terminal options') as HTMLButtonElement).disabled).toBe(true)
  })
})
