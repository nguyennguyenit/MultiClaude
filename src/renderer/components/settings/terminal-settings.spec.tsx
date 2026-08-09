import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings } from '@shared/types'
import { useSettingsStore } from '../../stores'
import {
  getClaudeRendererControlState,
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

  it('shows an English helper badge and tooltip for the default Claude-safe renderer path', () => {
    const html = renderToStaticMarkup(<TerminalSettings />)

    expect(html).toContain('Claude-safe mode')
    expect(html).toContain('Claude terminals stay on the safer canvas renderer.')
    expect(html).toContain('Balanced and Quality still use WebGL for non-Claude terminals.')
  })

  it('updates the helper badge copy when the experimental Claude GPU override is enabled', () => {
    expect(getClaudeRendererControlState('balanced', true)).toEqual({
      badge: 'Claude follows mode',
      description: 'Claude terminals use the selected render mode.',
      tooltip: 'Performance keeps canvas everywhere. Balanced uses WebGL for the active terminal. Quality uses WebGL for all visible terminals.',
      toggleDescription: 'Experimental. When enabled, Claude terminals use the selected GPU render mode.',
      disabled: false
    })
  })

  it('disables the Claude GPU override in Performance mode and explains why', () => {
    expect(getClaudeRendererControlState('performance', true)).toEqual({
      badge: 'GPU unavailable',
      description: 'Performance mode disables GPU rendering for all terminals.',
      tooltip: 'Switch to Balanced or Quality to choose whether Claude terminals can use GPU rendering.',
      toggleDescription: 'Unavailable in Performance mode because GPU rendering is off for all terminals.',
      disabled: true
    })
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
