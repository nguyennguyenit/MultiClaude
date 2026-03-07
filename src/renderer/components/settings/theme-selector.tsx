import { useSettingsStore } from '../../stores'
import { THEMES, TERMINAL_FONTS } from '@shared/constants'
import type { ColorTheme, TerminalFontId } from '@shared/types'
import { SettingsTitle, SettingsSubheading } from './settings-typography'

export function ThemeSelector() {
  const { pendingSettings, setColorTheme, setTerminalFontFamily } = useSettingsStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '16px' }}>
      <SettingsTitle description="Customize how MultiClaude looks">Appearance</SettingsTitle>

      {/* Color Theme */}
      <div>
        <SettingsSubheading>Color Theme</SettingsSubheading>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '4px' }}>
          5 curated dark themes. Changes apply instantly.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                  gap: '8px',
                  padding: '12px',
                  background: theme.background,
                  border: `2px solid ${isSelected ? theme.accent : theme.border}`,
                  cursor: 'pointer',
                  width: '120px',
                  textAlign: 'left',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {/* Color swatches */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[theme.background, theme.accent, theme.red, theme.green, theme.blue].map((color, i) => (
                    <div
                      key={i}
                      style={{ width: '12px', height: '12px', background: color, flexShrink: 0 }}
                    />
                  ))}
                </div>
                {/* Name */}
                <span style={{ fontSize: '11px', color: theme.foreground, fontWeight: 500 }}>
                  {theme.name}
                </span>
                {isSelected && (
                  <span style={{ fontSize: '10px', color: theme.accent, opacity: 0.9 }}>✓ active</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Terminal Font */}
      <div>
        <SettingsSubheading>Terminal Font</SettingsSubheading>
        <select
          value={pendingSettings.terminalFontFamily ?? 'jetbrains-mono'}
          onChange={(e) => setTerminalFontFamily(e.target.value as TerminalFontId)}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          {TERMINAL_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.name}
            </option>
          ))}
        </select>
        <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Preview:{' '}
          <span style={{ fontFamily: TERMINAL_FONTS.find(f => f.id === (pendingSettings.terminalFontFamily ?? 'jetbrains-mono'))?.family }}>
            The quick brown fox
          </span>
        </p>
      </div>
    </div>
  )
}
