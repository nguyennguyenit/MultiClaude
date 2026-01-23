import { useSettingsStore } from '../../stores'
import { COLOR_THEMES } from '@shared/constants'
import type { ThemeMode, ColorThemeDefinition, UiStyle } from '@shared/types'
import { SettingsTitle, SettingsSubheading } from './settings-typography'
import { TerminalStyleOptions } from './terminal-style-options'

export function ThemeSelector() {
  const { pendingSettings, setThemeMode, setColorTheme, setUiStyle } = useSettingsStore()

  const isDark = pendingSettings.themeMode === 'dark' ||
    (pendingSettings.themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="space-y-8 pb-4 max-w-2xl">
      {/* Section Header */}
      <SettingsTitle description="Customize how MultiClaude looks">
        Appearance
      </SettingsTitle>

      <div className="space-y-6">
        {/* Appearance Mode */}
        <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
          <SettingsSubheading>Appearance Mode</SettingsSubheading>
          <div className="mt-3">
            <p className="text-xs text-[var(--mc-text-muted)] mb-3">
              Choose light, dark, or system preference
            </p>
            <div className="flex gap-3">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                <ModeCard
                  key={mode}
                  mode={mode}
                  selected={pendingSettings.themeMode === mode}
                  onClick={() => setThemeMode(mode)}
                />
              ))}
            </div>
          </div>
        </div>

          {/* UI Style */}
          <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
            <SettingsSubheading>UI Style</SettingsSubheading>
            <div className="mt-3">
              <p className="text-xs text-[var(--mc-text-muted)] mb-3">
                Choose between modern or retro terminal interface
              </p>
              <div className="flex gap-3">
                <UIStyleCard
                  style="modern"
                  label="Modern"
                  selected={pendingSettings.uiStyle === 'modern'}
                  onClick={() => setUiStyle('modern')}
                />
                <UIStyleCard
                  style="terminal"
                  label="Terminal"
                  selected={pendingSettings.uiStyle === 'terminal'}
                  onClick={() => setUiStyle('terminal')}
                />
              </div>
            </div>
          </div>

          {/* Terminal Style Options - conditional */}
          {pendingSettings.uiStyle === 'terminal' && <TerminalStyleOptions />}

        {/* Color Theme */}
        <div className={`p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)] ${pendingSettings.uiStyle === 'terminal' ? 'opacity-50 pointer-events-none' : ''}`}>
          <SettingsSubheading>Color Theme</SettingsSubheading>
          <div className="mt-3">
            {pendingSettings.uiStyle === 'terminal' && (
              <p className="text-xs text-[var(--mc-text-muted)] mb-2 italic">
                Disabled in Terminal mode
              </p>
            )}
            <p className="text-xs text-[var(--mc-text-muted)] mb-3">
              Select a color palette for the interface
            </p>
            <div className="flex flex-wrap gap-2">
              {COLOR_THEMES.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  selected={pendingSettings.colorTheme === theme.id}
                  isDark={isDark}
                  onClick={() => setColorTheme(theme.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mode card component
function ModeCard({ mode, selected, onClick }: {
  mode: ThemeMode
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Select ${mode} appearance mode`}
      aria-pressed={selected}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border-2 w-[140px]
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50
        ${selected
          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
      `}
    >
      <span className="text-xl">
        {mode === 'system' && <SystemIcon />}
        {mode === 'light' && <SunIcon />}
        {mode === 'dark' && <MoonIcon />}
      </span>
      <span className="text-sm capitalize flex-1">{mode}</span>
      {selected && <span className="text-[var(--mc-accent)]">✓</span>}
    </button>
  )
}

// UI Style card component
function UIStyleCard({ style, label, selected, onClick }: {
  style: UiStyle
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Select ${label} UI style`}
      aria-pressed={selected}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border-2 w-[140px]
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50
        ${selected
          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
      `}
    >
      <span className="text-xl">
        {style === 'modern' && <ModernIcon />}
        {style === 'terminal' && <TerminalIcon />}
      </span>
      <span className="text-sm capitalize flex-1">{label}</span>
      {selected && <span className="text-[var(--mc-accent)]">✓</span>}
    </button>
  )
}

// Theme card component
function ThemeCard({ theme, selected, isDark, onClick }: {
  theme: ColorThemeDefinition
  selected: boolean
  isDark: boolean
  onClick: () => void
}) {
  const bgColor = isDark ? theme.previewColors.darkBg : theme.previewColors.bg
  const accentColor = isDark
    ? (theme.previewColors.darkAccent || theme.previewColors.accent)
    : theme.previewColors.accent

  return (
    <button
      onClick={onClick}
      className={`
        p-3 rounded-lg border-2 text-left transition-all duration-150 w-[180px] h-[76px]
        ${selected
          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
      `}
    >
      <div className="flex gap-1.5 mb-2">
        <div
          className="w-5 h-5 rounded-full border border-[var(--mc-border)]"
          style={{ backgroundColor: bgColor }}
        />
        <div
          className="w-5 h-5 rounded-full border border-[var(--mc-border)]"
          style={{ backgroundColor: accentColor }}
        />
      </div>
      <span className="text-sm font-medium flex items-center gap-1">
        {theme.name}
        {selected && <span className="text-[var(--mc-accent)]">✓</span>}
      </span>
    </button>
  )
}

// Icons
function SunIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" strokeWidth="2" />
      <path strokeWidth="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
      <path strokeWidth="2" d="M8 21h8M12 17v4" />
    </svg>
  )
}

function ModernIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth="2" />
      <path strokeWidth="2" d="M3 9h18M9 21V9" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="2" />
      <path strokeWidth="2" d="M6 10l4 4-4 4M12 18h6" />
    </svg>
  )
}
