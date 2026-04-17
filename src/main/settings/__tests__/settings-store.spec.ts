import { describe, expect, it } from 'vitest'
import { SCROLLBACK_DEFAULT, SCROLLBACK_MAX, SCROLLBACK_MIN } from '@shared/constants'
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

  it('persists the Claude GPU renderer override flag', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ gpuRendererForClaudeTerminals: true } as never)

    expect((updated as { gpuRendererForClaudeTerminals?: boolean }).gpuRendererForClaudeTerminals).toBe(true)
    expect((store.getSettings() as { gpuRendererForClaudeTerminals?: boolean }).gpuRendererForClaudeTerminals).toBe(true)
  })

  it('persists a valid scrollbackLines value within range', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ scrollbackLines: 50_000 })

    expect(updated.scrollbackLines).toBe(50_000)
    expect(store.getSettings().scrollbackLines).toBe(50_000)
  })

  it('clamps scrollbackLines below the minimum up to the floor', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ scrollbackLines: 10 })

    expect(updated.scrollbackLines).toBe(SCROLLBACK_MIN)
  })

  it('clamps scrollbackLines above the maximum down to the ceiling', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ scrollbackLines: 10_000_000 })

    expect(updated.scrollbackLines).toBe(SCROLLBACK_MAX)
  })

  it('falls back to the default when scrollbackLines is not a finite number', () => {
    const store = new SettingsStore()

    const updated = store.setSettings({ scrollbackLines: Number.NaN as never })

    expect(updated.scrollbackLines).toBe(SCROLLBACK_DEFAULT)
  })
})
