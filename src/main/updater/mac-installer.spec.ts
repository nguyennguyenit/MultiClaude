import { describe, expect, it } from 'vitest'
import { getUpdateInstallMode, pickMacDmgAsset } from './mac-installer'

function asset(name: string) {
  return {
    name,
    browser_download_url: `https://example.com/${name}`,
    size: 123
  }
}

describe('pickMacDmgAsset', () => {
  it('returns null when no dmg asset exists', () => {
    expect(pickMacDmgAsset([asset('MultiClaude.zip')])).toBeNull()
  })

  it('prefers arm64 dmg on arm64 macs', () => {
    const selected = pickMacDmgAsset([
      asset('MultiClaude-3.0.1.dmg'),
      asset('MultiClaude-3.0.1-arm64.dmg'),
      asset('MultiClaude-3.0.1-x64.dmg')
    ], 'arm64')

    expect(selected?.name).toBe('MultiClaude-3.0.1-arm64.dmg')
  })

  it('prefers x64 dmg on x64 macs', () => {
    const selected = pickMacDmgAsset([
      asset('MultiClaude-3.0.1-universal.dmg'),
      asset('MultiClaude-3.0.1-arm64.dmg'),
      asset('MultiClaude-3.0.1-x64.dmg')
    ], 'x64')

    expect(selected?.name).toBe('MultiClaude-3.0.1-x64.dmg')
  })

  it('falls back to universal dmg when no exact arch match exists', () => {
    const selected = pickMacDmgAsset([
      asset('MultiClaude-3.0.1-universal.dmg'),
      asset('MultiClaude-3.0.1-arm64.dmg')
    ], 'x64')

    expect(selected?.name).toBe('MultiClaude-3.0.1-universal.dmg')
  })
})

describe('getUpdateInstallMode', () => {
  it('uses open-installer mode on macOS', () => {
    expect(getUpdateInstallMode('darwin')).toBe('open-installer')
  })

  it('uses auto-install mode on other platforms', () => {
    expect(getUpdateInstallMode('win32')).toBe('auto-install')
    expect(getUpdateInstallMode('linux')).toBe('auto-install')
  })
})
