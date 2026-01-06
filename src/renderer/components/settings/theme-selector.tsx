import { useSettingsStore } from '../../stores'
import { COLOR_THEMES } from '@shared/constants'
import type { ThemeMode, ColorThemeDefinition, TerminalRenderMode } from '@shared/types'

// Render mode definitions for UI display
const RENDER_MODES: { id: TerminalRenderMode; name: string; description: string }[] = [
  { id: 'performance', name: 'Performance', description: 'No WebGL, best for many terminals' },
  { id: 'balanced', name: 'Balanced', description: 'WebGL only for active terminal' },
  { id: 'quality', name: 'Quality', description: 'WebGL always, best visual quality' }
]

export function ThemeSelector() {
  const { settings, setThemeMode, setColorTheme, setTerminalRenderMode } = useSettingsStore()

  const isDark = settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-medium">Appearance</h3>
        <p className="text-sm text-[var(--mc-text-muted)]">
          Customize how MultiClaude looks
        </p>
        <hr className="my-4 border-[var(--mc-border)]" />
      </div>

      {/* Appearance Mode */}
      <div>
        <h4 className="text-sm font-medium mb-1">Appearance Mode</h4>
        <p className="text-xs text-[var(--mc-text-muted)] mb-3">
          Choose light, dark, or system preference
        </p>
        <div className="flex gap-3">
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <ModeCard
              key={mode}
              mode={mode}
              selected={settings.themeMode === mode}
              onClick={() => setThemeMode(mode)}
            />
          ))}
        </div>
      </div>

      {/* Color Theme */}
      <div>
        <h4 className="text-sm font-medium mb-1">Color Theme</h4>
        <p className="text-xs text-[var(--mc-text-muted)] mb-3">
          Select a color palette for the interface
        </p>
        <div className="flex flex-wrap gap-2">
          {COLOR_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={settings.colorTheme === theme.id}
              isDark={isDark}
              onClick={() => setColorTheme(theme.id)}
            />
          ))}
        </div>
      </div>

      {/* Terminal Rendering Mode */}
      <div>
        <h4 className="text-sm font-medium mb-1">Terminal Rendering</h4>
        <p className="text-xs text-[var(--mc-text-muted)] mb-3">
          Optimize terminal performance vs visual quality
        </p>
        <div className="flex gap-2">
          {RENDER_MODES.map((mode) => (
            <RenderModeCard
              key={mode.id}
              mode={mode}
              selected={settings.terminalRenderMode === mode.id}
              onClick={() => setTerminalRenderMode(mode.id)}
            />
          ))}
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
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border-2 w-[140px]
        transition-all duration-150
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

// Render mode card component
function RenderModeCard({ mode, selected, onClick }: {
  mode: { id: TerminalRenderMode; name: string; description: string }
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col px-4 py-3 rounded-lg border-2 w-[140px]
        transition-all duration-150
        ${selected
          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
      `}
    >
      <span className="text-sm font-medium flex items-center gap-1">
        {mode.name}
        {selected && <span className="text-[var(--mc-accent)]">✓</span>}
      </span>
      <span className="text-xs text-[var(--mc-text-muted)] mt-1">{mode.description}</span>
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
