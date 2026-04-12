import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

let TerminalActionBar: typeof import('./terminal-action-bar').TerminalActionBar

beforeAll(async () => {
  const mod = await import('./terminal-action-bar')
  TerminalActionBar = mod.TerminalActionBar
})

const baseProps = {
  terminalCount: 3,
  terminalLimit: 10,
  yoloEnabled: false,
  onAddTerminal: vi.fn(),
  onToggleYolo: vi.fn(),
  onKillAll: vi.fn(),
  onCycleLayout: vi.fn()
}

describe('TerminalActionBar', () => {
  test('renders invisible placeholder when terminalCount is 0 (preserves layout space)', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} terminalCount={0} />
    )
    // Must render a DOM element (not empty) so layout space is reserved
    expect(html).not.toBe('')
    expect(html).toContain('action-bar')
    expect(html).toContain('visibility')
  })

  test('renders terminal count display', () => {
    const html = renderToStaticMarkup(<TerminalActionBar {...baseProps} />)
    expect(html).toContain('3 / 10')
  })

  test('renders action-bar class (24px bottom bar)', () => {
    const html = renderToStaticMarkup(<TerminalActionBar {...baseProps} />)
    expect(html).toContain('class="action-bar')
  })

  test('YOLO button has aria-pressed=false when disabled', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} yoloEnabled={false} />
    )
    expect(html).toContain('aria-pressed="false"')
  })

  test('YOLO button has aria-pressed=true when enabled', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} yoloEnabled={true} />
    )
    expect(html).toContain('aria-pressed="true"')
  })

  test('YOLO button has yolo-active class when enabled', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} yoloEnabled={true} />
    )
    expect(html).toContain('yolo-active')
  })

  test('new terminal button is disabled when at limit', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} terminalCount={10} terminalLimit={10} />
    )
    // disabled attribute present
    expect(html).toMatch(/disabled/)
  })

  test('all buttons have title and aria-label for accessibility', () => {
    const html = renderToStaticMarkup(<TerminalActionBar {...baseProps} />)
    // Action bar buttons use ActionBarBtn which sets title + aria-label
    expect(html).toContain('title=')
    expect(html).toContain('aria-label=')
  })

  test('shell indicator rendered on left side', () => {
    const html = renderToStaticMarkup(<TerminalActionBar {...baseProps} />)
    expect(html).toContain('action-bar-shell-indicator')
  })
})
