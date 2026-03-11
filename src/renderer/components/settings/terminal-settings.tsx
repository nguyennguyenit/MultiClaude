import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSettingsStore } from '../../stores'
import { useToastStore } from '../../stores/toast-store'
import { getShellKey } from '../../utils'
import type { TerminalLimitPreset, TerminalRenderMode, WindowsShell } from '@shared/types'
import { SettingsTitle } from './settings-typography'

const PRESET_OPTIONS: { value: TerminalLimitPreset; label: string }[] = [
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 9, label: '9' },
  { value: 'custom', label: 'Custom' }
]

// Icons for render modes
const RENDER_MODE_ICONS: Record<string, string> = {
  performance: '⚡',
  balanced: '⚖️',
  quality: '✨'
}

// Render mode definitions for UI display
const RENDER_MODES: { id: TerminalRenderMode; name: string; description: string }[] = [
  { id: 'performance', name: 'Performance', description: 'No WebGL, best for many terminals' },
  { id: 'balanced', name: 'Balanced', description: 'WebGL only for active terminal' },
  { id: 'quality', name: 'Quality', description: 'WebGL always, best visual quality' }
]

export function TerminalSettings() {
  const { pendingSettings, wslInfo, setTerminalLimit, setTerminalRenderMode, setWindowsShell, setVietnameseImeFix } = useSettingsStore()
  const { addToast } = useToastStore()
  const { terminalLimit } = pendingSettings

  // Vietnamese IME state
  const [imeStatus, setImeStatus] = useState<{ claudePath: string | null; version: string | null } | null>(null)
  const [patching, setPatching] = useState(false)

  useEffect(() => {
    window.electron.vietnameseIme.status().then(setImeStatus).catch(() => {})
  }, [])

  const handleImeFix = useCallback(async (enabled: boolean) => {
    setVietnameseImeFix(enabled)
    if (enabled) {
      setPatching(true)
      try {
        const result = await window.electron.vietnameseIme.patch()
        if (result.success) {
          addToast(result.alreadyPatched ? 'Vietnamese IME already patched' : `Vietnamese IME fix applied (v${result.claudeVersion})`, 'info')
          // Refresh status
          window.electron.vietnameseIme.status().then(setImeStatus).catch(() => {})
        } else {
          addToast(result.message || 'Patch failed', 'error')
          setVietnameseImeFix(false)
        }
      } catch {
        addToast('Vietnamese IME patch failed unexpectedly', 'error')
        setVietnameseImeFix(false)
      } finally {
        setPatching(false)
      }
    }
  }, [setVietnameseImeFix, addToast])

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
    <div className="flex flex-col gap-6 pb-16 max-w-2xl">
      <SettingsTitle description="Configure terminal behavior and limits">
        Terminals
      </SettingsTitle>

      {/* Max Terminals per Project */}
      <div className="settings-card rounded-2xl flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">
              Max Terminals per Project
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-1">Limits the number of terminals per project</p>
          </div>
          {/* Show current value badge */}
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--mc-accent)]/15 text-[var(--mc-accent)] border border-[var(--mc-accent)]/30">
            {terminalLimit.preset === 'custom' ? `${customValue} max` : `${terminalLimit.preset} max`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {PRESET_OPTIONS.map((option) => {
            const isSelected = terminalLimit.preset === option.value
            return (
              <button
                key={option.value}
                onClick={() => handlePresetChange(option.value)}
                className={`
                  relative flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold min-w-[4rem]
                  transition-all duration-200
                  ${isSelected
                    ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] shadow-lg shadow-[var(--mc-accent)]/30 scale-105'
                    : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-secondary)] hover:text-[var(--mc-text-primary)] border border-transparent hover:border-[var(--mc-accent)]/30'}
                `}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {terminalLimit.preset === 'custom' && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-[var(--mc-text-muted)] uppercase tracking-wide">Custom limit</span>
            <input
              type="number"
              min={1}
              max={99}
              value={customValue}
              onChange={(e) => handleCustomValueChange(e.target.value)}
              className="w-20 px-3 py-1.5 text-sm rounded-lg
                bg-[var(--mc-bg-primary)] border border-[var(--mc-accent)]/40
                text-[var(--mc-text-primary)] font-semibold
                focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50 focus:border-[var(--mc-accent)]"
              placeholder="1-99"
            />
          </div>
        )}
      </div>

      {/* Default Shell - Windows only */}
      {showShellSettings && (
        <div className="settings-card rounded-2xl flex flex-col gap-4 p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">Shell for New Terminals</p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-1">Select the default shell when creating new terminals</p>
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
                    px-4 py-2 rounded-lg text-sm font-semibold
                    transition-all duration-200
                    ${isSelected
                      ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] shadow-lg shadow-[var(--mc-accent)]/30'
                      : 'bg-[var(--mc-bg-hover)] border border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50 text-[var(--mc-text-secondary)] hover:text-[var(--mc-text-primary)]'}
                  `}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Rendering Mode */}
      <div className="settings-card rounded-2xl flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">Rendering Mode</p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-1">Optimize terminal performance vs visual quality</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--mc-accent)]/15 text-[var(--mc-accent)] border border-[var(--mc-accent)]/30 capitalize">
            {pendingSettings.terminalRenderMode}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {RENDER_MODES.map((mode) => {
            const isSelected = pendingSettings.terminalRenderMode === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => setTerminalRenderMode(mode.id)}
                className={`
                  flex flex-col items-start px-4 py-3.5 rounded-xl
                  transition-all duration-200
                  ${isSelected
                    ? 'bg-[var(--mc-bg-active)] border-2 border-[var(--mc-accent)] shadow-md shadow-[var(--mc-accent)]/20'
                    : 'bg-[var(--mc-bg-hover)] border-2 border-transparent hover:border-[var(--mc-accent)]/30 hover:bg-[var(--mc-bg-active)]'}
                `}
              >
                <span className={`flex items-center gap-1.5 text-sm font-semibold ${isSelected ? 'text-[var(--mc-accent)]' : 'text-[var(--mc-text-primary)]'}`}>
                  <span className="text-base leading-none">{RENDER_MODE_ICONS[mode.id]}</span>
                  {mode.name}
                </span>
                <span className="text-xs text-[var(--mc-text-muted)] mt-0.5 text-left leading-relaxed">{mode.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Vietnamese IME Fix */}
      <div className="settings-card rounded-2xl flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">
              Vietnamese IME Fix
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-1">
              Fix input for Vietnamese keyboards (OpenKey, EVKey, Unikey, PHTV)
            </p>
          </div>
          {/* Status badge */}
          {imeStatus && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              !imeStatus.claudePath
                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                : pendingSettings.vietnameseImeFix
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : 'bg-[var(--mc-accent)]/15 text-[var(--mc-accent)] border-[var(--mc-accent)]/30'
            }`}>
              {!imeStatus.claudePath
                ? 'Claude not found'
                : pendingSettings.vietnameseImeFix
                  ? `Patched${imeStatus.version ? ` v${imeStatus.version}` : ''}`
                  : imeStatus.version ? `v${imeStatus.version}` : 'Detected'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleImeFix(!pendingSettings.vietnameseImeFix)}
            disabled={patching || !imeStatus?.claudePath}
            className={`
              relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0
              ${pendingSettings.vietnameseImeFix
                ? 'bg-[var(--mc-accent)]'
                : 'bg-[var(--mc-bg-hover)] border border-[var(--mc-border)]'}
              ${patching || !imeStatus?.claudePath ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className={`
              absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200
              ${pendingSettings.vietnameseImeFix
                ? 'translate-x-5 bg-[var(--mc-bg-primary)]'
                : 'translate-x-0 bg-[var(--mc-text-muted)]'}
            `} />
          </button>
          <span className="text-sm text-[var(--mc-text-secondary)]">
            {patching ? 'Patching...' : pendingSettings.vietnameseImeFix ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {!imeStatus?.claudePath && imeStatus !== null && (
          <p className="text-xs text-yellow-400/80">
            Claude Code CLI not found. Install it first via <code className="text-yellow-400">curl -fsSL https://claude.ai/install.sh | sh</code>
          </p>
        )}
      </div>

    </div>
  )
}
