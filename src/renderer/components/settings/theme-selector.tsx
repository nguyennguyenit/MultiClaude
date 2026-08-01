import { useSettingsStore } from '../../stores'
import { THEMES, TERMINAL_FONTS, APP_FONTS } from '@shared/constants'
import type { ColorTheme, TerminalFontId, AppFontId, ThemeMode } from '@shared/types'
import { SettingsTitle } from './settings-typography'
import { getFontFamily } from '../../utils'
import { resolveAppTheme } from '../../utils/app-theme'

export function ThemeSelector() {
  const {
    pendingSettings,
    setThemeMode,
    setColorTheme,
    setTerminalFontFamily,
    setModernFontFamily,
  } = useSettingsStore()

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-2xl">
      <SettingsTitle description="Customize how MultiClaude looks">Appearance</SettingsTitle>

      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Appearance Mode</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">
            Follow your system or choose a light or dark interface
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Appearance Mode">
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => {
            const isSelected = pendingSettings.themeMode === mode
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setThemeMode(mode)}
                className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  isSelected
                    ? 'border-[var(--mc-accent)] bg-[var(--mc-accent)]'
                    : 'border-[var(--mc-border)] bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)] hover:bg-[var(--mc-bg-hover)]'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mc-bg-primary)]`}
                style={isSelected ? { color: 'var(--on-accent)' } : undefined}
              >
                {mode}
              </button>
            )
          })}
        </div>
      </div>

      {/* Color Theme */}
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Color Theme</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">
            Select a color palette for the interface. Previews follow the selected appearance mode.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '12px' }}>
          {THEMES.map((theme) => {
            const isSelected = pendingSettings.colorTheme === theme.id
            const prefersDark = typeof window !== 'undefined'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
              : true
            const preview = resolveAppTheme(theme, pendingSettings.themeMode, prefersDark)
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setColorTheme(theme.id as ColorTheme)}
                aria-pressed={isSelected}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mc-bg-primary)]"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '14px',
                  background: preview.background,
                  border: `2px solid ${isSelected ? preview.accent : preview.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: isSelected ? `0 0 0 1px ${preview.accent}40` : 'none'
                }}
              >
                {/* Color swatches */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[preview.background, preview.accent, theme.red, theme.green, theme.blue].map((color, i) => (
                    <div
                      key={i}
                      style={{ width: '16px', height: '16px', borderRadius: '50%', background: color, flexShrink: 0 }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '13px', color: preview.foreground, fontWeight: 600, fontFamily: 'inherit' }}>
                  {theme.name}
                </span>
                {isSelected && (
                  <span style={{ fontSize: '11px', color: preview.accent, fontFamily: 'inherit' }}>✓ active</span>
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
          aria-label="App Font"
          name="app-font"
          autoComplete="off"
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
          aria-label="Terminal Font"
          name="terminal-font"
          autoComplete="off"
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
