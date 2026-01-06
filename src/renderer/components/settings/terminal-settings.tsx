import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores'
import type { TerminalLimitPreset, TerminalRenderMode } from '@shared/types'

const PRESET_OPTIONS: { value: TerminalLimitPreset; label: string }[] = [
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 9, label: '9' },
  { value: 'custom', label: 'Custom' }
]

// Render mode definitions for UI display
const RENDER_MODES: { id: TerminalRenderMode; name: string; description: string }[] = [
  { id: 'performance', name: 'Performance', description: 'No WebGL, best for many terminals' },
  { id: 'balanced', name: 'Balanced', description: 'WebGL only for active terminal' },
  { id: 'quality', name: 'Quality', description: 'WebGL always, best visual quality' }
]

export function TerminalSettings() {
  const { settings, setTerminalLimit, setTerminalRenderMode } = useSettingsStore()
  const { terminalLimit } = settings

  const [customValue, setCustomValue] = useState(
    terminalLimit.preset === 'custom' ? (terminalLimit.customValue ?? 9) : 9
  )

  // Sync custom value when settings change
  useEffect(() => {
    if (terminalLimit.preset === 'custom' && terminalLimit.customValue) {
      setCustomValue(terminalLimit.customValue)
    }
  }, [terminalLimit])

  const handlePresetChange = (preset: TerminalLimitPreset) => {
    if (preset === 'custom') {
      setTerminalLimit({ preset: 'custom', customValue })
    } else {
      setTerminalLimit({ preset })
    }
  }

  const handleCustomValueChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1 && num <= 99) {
      setCustomValue(num)
      if (terminalLimit.preset === 'custom') {
        setTerminalLimit({ preset: 'custom', customValue: num })
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-medium">Terminals</h3>
        <p className="text-sm text-[var(--mc-text-muted)]">
          Configure terminal behavior and limits
        </p>
        <hr className="my-4 border-[var(--mc-border)]" />
      </div>

      {/* Terminal Limit Section */}
      <SettingsSection title="General">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">Max Terminals per Project</span>
              <p className="text-xs text-[var(--mc-text-muted)]">
                Limits the number of terminals per project
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handlePresetChange(option.value)}
                className={`
                  flex items-center justify-center py-2 rounded text-sm
                  transition-colors duration-150
                  ${terminalLimit.preset === option.value
                    ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
                    : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Custom value input */}
          {terminalLimit.preset === 'custom' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--mc-text-secondary)]">Custom limit:</span>
              <input
                type="number"
                min={1}
                max={99}
                value={customValue}
                onChange={(e) => handleCustomValueChange(e.target.value)}
                className="w-20 px-3 py-1.5 text-sm rounded
                  bg-[var(--mc-bg-primary)] border border-[var(--mc-border)]
                  text-[var(--mc-text-primary)]
                  focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
                placeholder="1-99"
              />
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Terminal Rendering Mode */}
      <SettingsSection title="Rendering">
        <div className="space-y-3">
          <div>
            <span className="text-sm">Rendering Mode</span>
            <p className="text-xs text-[var(--mc-text-muted)]">
              Optimize terminal performance vs visual quality
            </p>
          </div>
          <div className="flex gap-2">
            {RENDER_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setTerminalRenderMode(mode.id)}
                className={`
                  flex flex-col px-4 py-3 rounded-lg border-2 w-[140px]
                  transition-all duration-150
                  ${settings.terminalRenderMode === mode.id
                    ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
                    : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
                `}
              >
                <span className="text-sm font-medium flex items-center gap-1">
                  {mode.name}
                  {settings.terminalRenderMode === mode.id && <span className="text-[var(--mc-accent)]">✓</span>}
                </span>
                <span className="text-xs text-[var(--mc-text-muted)] mt-1">{mode.description}</span>
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}

// Reusable settings section component
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-medium mb-3 text-[var(--mc-text-secondary)]">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
