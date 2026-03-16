import { useSettingsStore } from '../../stores'
import { THEMES, TERMINAL_FONTS, APP_FONTS } from '@shared/constants'
import type { ColorTheme, TerminalFontId, AppFontId } from '@shared/types'
import { SettingsTitle } from './settings-typography'
import { getFontFamily } from '../../utils'

export function ThemeSelector() {
  const { pendingSettings, setColorTheme, setTerminalFontFamily, setModernFontFamily } = useSettingsStore()

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-2xl">
      <SettingsTitle description="Customize how MultiClaude looks">Appearance</SettingsTitle>

      {/* Color Theme */}
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Color Theme</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Select a color palette for the interface</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '12px' }}>
          {THEMES.map((theme) => {
            const isSelected = pendingSettings.colorTheme === theme.id
            return (
              <button
                key={theme.id}
                onClick={() => setColorTheme(theme.id as ColorTheme)}
                aria-pressed={isSelected}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '14px',
                  background: theme.background,
                  border: `2px solid ${isSelected ? theme.accent : theme.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: isSelected ? `0 0 0 1px ${theme.accent}40` : 'none'
                }}
              >
                {/* Color swatches */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[theme.background, theme.accent, theme.red, theme.green, theme.blue].map((color, i) => (
                    <div
                      key={i}
                      style={{ width: '16px', height: '16px', borderRadius: '50%', background: color, flexShrink: 0 }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '13px', color: theme.foreground, fontWeight: 600, fontFamily: 'inherit' }}>
                  {theme.name}
                </span>
                {isSelected && (
                  <span style={{ fontSize: '11px', color: theme.accent, opacity: 0.9, fontFamily: 'inherit' }}>✓ active</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* App Font */}
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">App Font</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Font used across the entire interface</p>
        </div>
        <select
          value={pendingSettings.modernFontFamily ?? 'system'}
          onChange={(e) => setModernFontFamily(e.target.value as AppFontId)}
          className="w-full p-3 text-sm border border-[var(--mc-border)] bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)] rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
        >
          {APP_FONTS.map((font) => (
            <option key={font.id} value={font.id}>{font.name}</option>
          ))}
        </select>
        <p className="text-sm text-[var(--mc-text-muted)]">
          Preview:{' '}
          <span style={{ fontFamily: APP_FONTS.find(f => f.id === (pendingSettings.modernFontFamily ?? 'system'))?.family }}>
            The quick brown fox jumps over the lazy dog
          </span>
        </p>
      </div>

      {/* Terminal Font */}
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Terminal Font</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Font used inside terminal content</p>
        </div>
        <select
          value={pendingSettings.terminalFontFamily ?? 'jetbrains-mono'}
          onChange={(e) => setTerminalFontFamily(e.target.value as TerminalFontId)}
          className="w-full p-3 text-sm border border-[var(--mc-border)] bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)] rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
        >
          {TERMINAL_FONTS.map((font) => (
            <option key={font.id} value={font.id}>{font.name}</option>
          ))}
        </select>
        <p className="text-sm text-[var(--mc-text-muted)]">
          Preview:{' '}
          <span style={{ fontFamily: getFontFamily(pendingSettings.terminalFontFamily ?? 'jetbrains-mono') }}>
            The quick brown fox
          </span>
        </p>
      </div>
    </div>
  )
}
