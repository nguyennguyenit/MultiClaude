// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { useSettingsStore } from '../../stores'
import { ThemeSelector } from './theme-selector'

describe('ThemeSelector', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    })
    const settings = structuredClone(DEFAULT_SETTINGS)
    useSettingsStore.setState({
      savedSettings: settings,
      pendingSettings: settings,
      settings,
      hasUnsavedChanges: false,
    })
  })

  it('exposes system, light, and dark appearance modes', () => {
    render(<ThemeSelector />)

    const modeGroup = screen.getByRole('group', { name: 'Appearance Mode' })
    expect(modeGroup).toBeTruthy()
    expect(screen.getByRole('button', { name: 'system' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'light' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'dark' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('combobox', { name: 'App Font' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Terminal Font' })).toBeTruthy()
  })

  it('updates pending mode and unsaved state through the accessible controls', () => {
    render(<ThemeSelector />)

    fireEvent.click(screen.getByRole('button', { name: 'light' }))

    expect(useSettingsStore.getState().pendingSettings.themeMode).toBe('light')
    expect(useSettingsStore.getState().hasUnsavedChanges).toBe(true)
    expect(screen.getByRole('button', { name: 'light' }).getAttribute('aria-pressed')).toBe('true')
  })
})
