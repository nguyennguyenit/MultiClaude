import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores'
import type { TerminalLimitPreset } from '@shared/types'

const PRESET_OPTIONS: { value: TerminalLimitPreset; label: string }[] = [
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 9, label: '9' },
  { value: 'custom', label: 'Custom' }
]

export function TerminalSettings() {
  const { settings, setTerminalLimit } = useSettingsStore()
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
    <div className="space-y-4">
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">
          Terminal Limit per Project
        </div>
        <div className="grid grid-cols-4 gap-1">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePresetChange(option.value)}
              className={`
                flex items-center justify-center p-2 rounded text-xs
                ${terminalLimit.preset === option.value
                  ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
                  : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom value input */}
      {terminalLimit.preset === 'custom' && (
        <div>
          <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">
            Custom Limit
          </div>
          <input
            type="number"
            min={1}
            max={99}
            value={customValue}
            onChange={(e) => handleCustomValueChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded
              bg-[var(--mc-bg-primary)] border border-[var(--mc-border)]
              text-[var(--mc-text-primary)]
              focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
            placeholder="Enter number (1-99)"
          />
        </div>
      )}

      <div className="text-xs text-[var(--mc-text-muted)]">
        Limits the maximum number of terminals per project.
      </div>
    </div>
  )
}
