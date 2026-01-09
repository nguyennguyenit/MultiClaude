import { useState, useEffect, useMemo } from 'react'
import { useSettingsStore } from '../../stores'
import { getShellKey } from '../../utils'
import type { TerminalLimitPreset, TerminalRenderMode, WindowsShell } from '@shared/types'
import { SettingsTitle, SettingsSubheading } from './settings-typography'

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
  const { settings, wslInfo, setTerminalLimit, setTerminalRenderMode, setWindowsShell } = useSettingsStore()
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

  // Build shell options for dropdown (Windows with WSL only)
  const shellOptions = useMemo(() => {
    const options: { value: WindowsShell; label: string }[] = [
      { value: { type: 'cmd' }, label: 'Command Prompt' },
      { value: { type: 'powershell' }, label: 'PowerShell' }
    ]

    if (wslInfo?.distros) {
      wslInfo.distros.forEach((distro) => {
        options.push({
          value: { type: 'wsl', distro: distro.name },
          label: `WSL: ${distro.name}${distro.isDefault ? ' (default)' : ''}`
        })
      })
    }

    return options
  }, [wslInfo])

  // Show shell settings on Windows (wslInfo is only set on Windows platform)
  const showShellSettings = wslInfo !== null

  const currentShellKey = getShellKey(settings.windowsShell || { type: 'cmd' })

  return (

    <div className="space-y-8 pb-4 max-w-2xl">
      {/* Section Header */}
      <SettingsTitle description="Configure terminal behavior and limits">
        Terminals
      </SettingsTitle>

      <div className="space-y-6">
        {/* Terminal Limit Section */}
        <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
          <SettingsSubheading>General</SettingsSubheading>
          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[var(--mc-text-primary)]">Max Terminals per Project</span>
                <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">
                  Limits the number of terminals per project
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handlePresetChange(option.value)}
                  className={`
                    flex items-center justify-center px-4 py-2 rounded text-sm min-w-[3rem]
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
              <div className="flex items-center gap-3 pt-2">
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
        </div>

        {/* Default Shell Section - Windows only, WSL available */}
        {showShellSettings && (
          <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
            <SettingsSubheading>Default Shell</SettingsSubheading>
            <div className="space-y-3 mt-3">
              <div>
                <span className="text-sm font-medium text-[var(--mc-text-primary)]">Shell for New Terminals</span>
                <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">
                  Select the default shell when creating new terminals
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {shellOptions.map((option) => {
                  const optionKey = getShellKey(option.value)
                  const isSelected = optionKey === currentShellKey

                  return (
                    <button
                      key={optionKey}
                      onClick={() => setWindowsShell(option.value)}
                      className={`
                        px-4 py-2 rounded-lg border-2 text-sm
                        transition-all duration-150
                        ${isSelected
                          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
                          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
                      `}
                    >
                      <span className="flex items-center gap-2">
                        {option.label}
                        {isSelected && <span className="text-[var(--mc-accent)]">✓</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Terminal Rendering Mode */}
        <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
          <SettingsSubheading>Rendering</SettingsSubheading>
          <div className="space-y-3 mt-3">
            <div>
              <span className="text-sm font-medium text-[var(--mc-text-primary)]">Rendering Mode</span>
              <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">
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
                  <span className="text-xs text-[var(--mc-text-muted)] mt-1 text-left">{mode.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
