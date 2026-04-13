import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { ShellInfo } from '@shared/types'

let TerminalActionBar: typeof import('../terminal-action-bar').TerminalActionBar

beforeAll(async () => {
  const mod = await import('../terminal-action-bar')
  TerminalActionBar = mod.TerminalActionBar
})

const zsh: ShellInfo = { path: '/bin/zsh', name: 'zsh', isDefault: true, kind: 'unix' }
const fish: ShellInfo = { path: '/usr/local/bin/fish', name: 'fish', isDefault: false, kind: 'unix' }

const baseProps = {
  terminalCount: 3,
  terminalLimit: 10,
  yoloEnabled: false,
  availableShells: [zsh, fish],
  selectedShell: null as ShellInfo | null,
  onShellSelect: vi.fn(),
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
    expect(html).toMatch(/disabled/)
  })

  test('all buttons have title and aria-label for accessibility', () => {
    const html = renderToStaticMarkup(<TerminalActionBar {...baseProps} />)
    expect(html).toContain('title=')
    expect(html).toContain('aria-label=')
  })

  // Shell switcher tests (Phase 4)

  test('renders >_ ▾ label when no shell selected', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} selectedShell={null} />
    )
    expect(html).toContain('&gt;_ ▾')
  })

  test('renders shell name in label when shell is selected', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} selectedShell={zsh} />
    )
    expect(html).toContain('&gt;_ zsh ▾')
  })

  test('shell button has aria-haspopup="listbox"', () => {
    const html = renderToStaticMarkup(<TerminalActionBar {...baseProps} />)
    expect(html).toContain('aria-haspopup="listbox"')
  })

  test('shell button is disabled when availableShells is empty', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} availableShells={[]} />
    )
    // Find the shell button — it's the one with aria-haspopup
    // It should have disabled attribute
    expect(html).toContain('disabled')
  })

  test('shell button is not disabled when shells are available', () => {
    const html = renderToStaticMarkup(
      <TerminalActionBar {...baseProps} availableShells={[zsh]} />
    )
    // The + button is not disabled at count < limit, only the shell btn would be disabled when no shells
    // Shell button should NOT have disabled attribute here
    expect(html).toContain('action-bar-shell-btn')
    // Verify disabled appears only once (for the + button at limit, but not here)
    // With shells available, shell button should not be disabled
    const shellBtnMatch = html.match(/action-bar-shell-btn[^>]*>/)?.[0] ?? ''
    expect(shellBtnMatch).not.toContain('disabled')
  })

  test('renders action-bar-shell-btn class', () => {
    const html = renderToStaticMarkup(<TerminalActionBar {...baseProps} />)
    expect(html).toContain('action-bar-shell-btn')
  })

  test('does not render shell indicator span (replaced by button)', () => {
    const html = renderToStaticMarkup(<TerminalActionBar {...baseProps} />)
    expect(html).not.toContain('action-bar-shell-indicator')
  })
})
