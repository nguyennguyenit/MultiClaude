import { useState, useEffect, useMemo } from 'react'
import { useSettingsStore } from '../../stores'
import { getShellKey, getFontFamily } from '../../utils'
import { TERMINAL_FONTS } from '@shared/constants'
import type { TerminalLimitPreset, TerminalRenderMode, WindowsShell, TerminalFontId } from '@shared/types'
import { SettingsTitle } from './settings-typography'

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
  const { pendingSettings, wslInfo, setTerminalLimit, setTerminalRenderMode, setWindowsShell, setTerminalFontFamily } = useSettingsStore()
  const { terminalLimit } = pendingSettings

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

  const currentShellKey = getShellKey(pendingSettings.windowsShell || { type: 'cmd' })

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-2xl">
      <SettingsTitle description="Configure terminal behavior and limits">
        Terminals
      </SettingsTitle>

      {/* Max Terminals per Project */}
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Max Terminals per Project</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Limits the number of terminals per project</p>
        </div>
        <div className="flex items-center gap-2">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePresetChange(option.value)}
              className={`
                flex items-center justify-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium min-w-[4rem]
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
        {terminalLimit.preset === 'custom' && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--mc-text-secondary)]">Custom limit:</span>
            <input
              type="number"
              min={1}
              max={99}
              value={customValue}
              onChange={(e) => handleCustomValueChange(e.target.value)}
              className="w-20 px-3 py-1.5 text-sm rounded-md
                bg-[var(--mc-bg-primary)] border border-[var(--mc-border)]
                text-[var(--mc-text-primary)]
                focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
              placeholder="1-99"
            />
          </div>
        )}
      </div>

      {/* Default Shell - Windows only */}
      {showShellSettings && (
        <>
          <div className="settings-card rounded-xl flex flex-col gap-3">
            <div>
              <p className="text-base font-semibold text-[var(--mc-text-primary)]">Shell for New Terminals</p>
              <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Select the default shell when creating new terminals</p>
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
                      px-4 py-2 rounded-md border text-sm font-medium
                      transition-all duration-150
                      ${isSelected
                        ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'
                        : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50 text-[var(--mc-text-primary)]'}
                    `}
                  >
                    <span className="flex items-center gap-1.5">
                      {option.label}
                      {isSelected && <span className="text-[var(--mc-accent)]">✓</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Rendering Mode */}
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Rendering Mode</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Optimize terminal performance vs visual quality</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RENDER_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setTerminalRenderMode(mode.id)}
              className={`
                flex flex-col px-4 py-3 rounded-lg border flex-1 min-w-[130px]
                transition-all duration-150
                ${pendingSettings.terminalRenderMode === mode.id
                  ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
                  : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
              `}
            >
              <span className="text-sm font-semibold flex items-center gap-1.5">
                {mode.name}
                {pendingSettings.terminalRenderMode === mode.id && <span className="text-[var(--mc-accent)]">✓</span>}
              </span>
              <span className="text-xs text-[var(--mc-text-muted)] mt-1 text-left leading-relaxed">{mode.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Font */}
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Font Family</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Font used inside terminal content</p>
        </div>
        <label htmlFor="terminal-content-font-select" className="sr-only">
          Select terminal font
        </label>
        <select
          id="terminal-content-font-select"
          value={pendingSettings.terminalFontFamily ?? 'jetbrains-mono'}
          onChange={(e) => setTerminalFontFamily(e.target.value as TerminalFontId)}
          className="w-full p-3 text-sm border border-[var(--mc-border)] bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)] rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
        >
          {TERMINAL_FONTS.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
              {font.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-[var(--mc-text-muted)]">
          Preview: <span style={{ fontFamily: getFontFamily(pendingSettings.terminalFontFamily) }}>$ echo &quot;Hello World&quot;</span>
        </p>
      </div>
    </div>
  )
}
