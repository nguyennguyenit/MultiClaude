import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings } from '@shared/types'
import { useSettingsStore } from '../../stores'
import { getClaudeRendererControlState, TerminalSettings } from './terminal-settings'

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
})
