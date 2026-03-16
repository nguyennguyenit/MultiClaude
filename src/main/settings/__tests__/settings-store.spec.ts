import { describe, expect, it } from 'vitest'
import { SettingsStore } from '../settings-store'

describe('SettingsStore', () => {
  it('persists terminalFontFamily selections', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ terminalFontFamily: 'system' })

    expect(updated.terminalFontFamily).toBe('system')
    expect(store.getSettings().terminalFontFamily).toBe('system')
  })

  it('rejects invalid terminalFontFamily values', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ terminalFontFamily: 'invalid-font' as never })

    expect(updated.terminalFontFamily).toBe('jetbrains-mono')
  })
})
