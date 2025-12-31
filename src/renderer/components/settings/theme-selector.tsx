import { useSettingsStore } from '../../stores'
import { COLOR_THEMES } from '@shared/constants'
import type { ThemeMode } from '@shared/types'

export function ThemeSelector() {
  const { settings, setThemeMode, setColorTheme } = useSettingsStore()

  const isDark = settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Appearance</div>
        <div className="grid grid-cols-3 gap-1">
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setThemeMode(mode)}
              className={`
                flex flex-col items-center gap-1 p-2 rounded text-xs capitalize
                ${settings.themeMode === mode
                  ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
                  : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'
                }
              `}
            >
              {mode === 'system' && <SystemIcon />}
              {mode === 'light' && <SunIcon />}
              {mode === 'dark' && <MoonIcon />}
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Color Theme Grid */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Color Theme</div>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_THEMES.map((theme) => {
            const isSelected = settings.colorTheme === theme.id
            const bgColor = isDark ? theme.previewColors.darkBg : theme.previewColors.bg
            const accentColor = isDark
              ? (theme.previewColors.darkAccent || theme.previewColors.accent)
              : theme.previewColors.accent

            return (
              <button
                key={theme.id}
                onClick={() => setColorTheme(theme.id)}
                className={`
                  relative flex flex-col p-2 rounded text-left text-xs
                  ${isSelected
                    ? 'ring-2 ring-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
                    : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)]'
                  }
                `}
              >
                {/* Preview swatches */}
                <div className="flex gap-1 mb-1">
                  <div
                    className="w-4 h-4 rounded-full border border-[var(--mc-border)]"
                    style={{ backgroundColor: bgColor }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-[var(--mc-border)]"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
                <span className="font-medium text-[var(--mc-text-primary)]">{theme.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Simple inline icons
function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" strokeWidth="2" />
      <path strokeWidth="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
      <path strokeWidth="2" d="M8 21h8M12 17v4" />
    </svg>
  )
}
