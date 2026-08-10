import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings } from '@shared/types'
import { useSettingsStore } from '../../stores'
import {
  getScrollbackRetentionNotice,
  shouldShowTerminalEngineSelector,
  TerminalSettings,
} from './terminal-settings'

function cloneDefaultSettings(): AppSettings {
  return structuredClone(DEFAULT_SETTINGS)
}

describe('TerminalSettings', () => {
  beforeEach(() => {
    const settings = cloneDefaultSettings()
    useSettingsStore.setState({
      savedSettings: settings,
      pendingSettings: settings,
      settings,
      hasUnsavedChanges: false,
      wslInfo: null,
      gitPanelOpen: false,
      settingsModalOpen: false
    })
  })

  it('does not render the retired renderer mode card or Claude GPU control', () => {
    const html = renderToStaticMarkup(<TerminalSettings />)

    expect(html).not.toContain('Rendering Mode')
    expect(html).not.toContain('Use GPU renderer for Claude terminals')
    expect(html).not.toContain('Performance')
    expect(html).not.toContain('Balanced')
    expect(html).not.toContain('Quality')
    expect(html).not.toContain('canvas renderer')
  })

  it('renders the Advanced context-window controls with restart hint', () => {
    const html = renderToStaticMarkup(<TerminalSettings />)

    expect(html).toContain('Advanced features')
    expect(html).toContain('Turn-injection diff')
    expect(html).not.toContain('Thinking syntax highlighting')
    expect(html).toContain('Requires restart')
  })

  it('shows the engine selector only when the native backend is available', () => {
    expect(shouldShowTerminalEngineSelector(null)).toBe(false)
    expect(shouldShowTerminalEngineSelector({ available: false, platform: 'darwin' })).toBe(false)
    expect(shouldShowTerminalEngineSelector({ available: true, platform: 'linux' })).toBe(false)
    expect(shouldShowTerminalEngineSelector({ available: true, platform: 'darwin' })).toBe(true)
  })

  it('renders the Scrollback Lines card with the default value badge', () => {
    const html = renderToStaticMarkup(<TerminalSettings />)

    expect(html).toContain('Scrollback Lines')
    expect(html).toContain('20k lines')
    expect(html).toContain('Refresh keeps 20k canonical lines')
    expect(html).toContain('separate local 3 MB raw tail')
    expect(html).toContain('5k')
    expect(html).toContain('100k')
    expect(html).toContain('Custom')
  })

  it('labels values above the canonical refresh cap as live-only', () => {
    expect(getScrollbackRetentionNotice(20_000)).toBeNull()
    expect(getScrollbackRetentionNotice(50_000)).toContain('Values above 20k are live-only')
    expect(getScrollbackRetentionNotice(50_000)).toContain('app restart uses a separate local raw tail capped at 3 MB')
  })

  // NOTE: zustand store updates don't reflect in renderToStaticMarkup SSR output
  // in this project's current test setup, so assertions that depend on a
  // mutated store slice cannot be verified here. The setScrollbackLines reducer
  // itself is covered in src/renderer/stores/settings-store.spec.ts.
})
