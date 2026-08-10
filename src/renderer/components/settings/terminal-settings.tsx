import { useState, useEffect, useMemo } from 'react'
import { useSettingsStore } from '../../stores'
import { getShellKey, shellInfoToWindowsShell } from '../../utils'
import type { ShellInfo, TerminalLimitPreset } from '@shared/types'
import {
  CANONICAL_SCROLLBACK_LINES,
  SCROLLBACK_DEFAULT,
  SCROLLBACK_MIN,
  SCROLLBACK_MAX,
  SCROLLBACK_PRESETS,
} from '@shared/constants'
import { SettingsTitle } from './settings-typography'
import { ToggleSwitch } from './toggle-switch'

function formatScrollback(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return `${value}`
}

export function getScrollbackRetentionNotice(lines: number): string | null {
  if (lines <= CANONICAL_SCROLLBACK_LINES) return null
  const cap = formatScrollback(CANONICAL_SCROLLBACK_LINES)
  return `Values above ${cap} are live-only and use more memory. Refresh restores ${cap} canonical lines; app restart uses a separate local raw tail capped at 3 MB.`
}

export function shouldShowTerminalEngineSelector(
  capability: { available: boolean; platform: NodeJS.Platform } | null,
): boolean {
  return capability?.platform === 'darwin' && capability.available
}

const PRESET_OPTIONS: { value: TerminalLimitPreset; label: string }[] = [
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 9, label: '9' },
  { value: 'custom', label: 'Custom' }
]

export function TerminalSettings() {
  const {
    pendingSettings,
    wslInfo,
    setTerminalLimit,
    setTerminalEngine,
    setScrollbackLines,
    setEnableContextWindow,
    setEnableContextWindowAdvanced,
    setDefaultShell
  } = useSettingsStore()
  const [nativeCapability, setNativeCapability] = useState<{
    available: boolean
    platform: NodeJS.Platform
  } | null>(null)
  const { terminalLimit } = pendingSettings
  const scrollbackLines = pendingSettings.scrollbackLines ?? SCROLLBACK_DEFAULT
  const scrollbackRetentionNotice = getScrollbackRetentionNotice(scrollbackLines)
  const isScrollbackPreset = (SCROLLBACK_PRESETS as readonly number[]).includes(scrollbackLines)
  const [customScrollback, setCustomScrollback] = useState(
    isScrollbackPreset ? SCROLLBACK_DEFAULT : scrollbackLines
  )

  // Keep custom input in sync if user enters a non-preset value via external save
  useEffect(() => {
    if (!isScrollbackPreset) setCustomScrollback(scrollbackLines)
  }, [scrollbackLines, isScrollbackPreset])

  useEffect(() => {
    let cancelled = false
    void window.electron.terminal.getNativeCapability().then((capability) => {
      if (!cancelled) setNativeCapability(capability)
    }).catch(() => {
      if (!cancelled) setNativeCapability(null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const [customValue, setCustomValue] = useState(
    terminalLimit.preset === 'custom' ? (terminalLimit.customValue ?? 9) : 9
  )

  // Sync custom value when settings change
  useEffect(() => {
    if (terminalLimit.preset === 'custom' && terminalLimit.customValue) {
      setCustomValue(terminalLimit.customValue)
    }
  }, [terminalLimit])

  const handleScrollbackPreset = (value: number) => {
    setScrollbackLines(value)
  }

  const handleScrollbackCustom = (raw: string) => {
    const num = parseInt(raw, 10)
    if (!Number.isFinite(num)) return
    const clamped = Math.min(SCROLLBACK_MAX, Math.max(SCROLLBACK_MIN, num))
    setCustomScrollback(clamped)
    setScrollbackLines(clamped)
  }

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
    const options: { value: ShellInfo; label: string }[] = [
      { value: { path: 'cmd.exe', name: 'Command Prompt', isDefault: true, kind: 'cmd' }, label: 'Command Prompt' },
      { value: { path: 'powershell.exe', name: 'PowerShell', isDefault: true, kind: 'powershell' }, label: 'PowerShell' }
    ]

    if (wslInfo?.distros) {
      wslInfo.distros.forEach((distro) => {
        options.push({
          value: {
            path: 'wsl.exe',
            name: distro.name,
            distro: distro.name,
            isDefault: distro.isDefault,
            kind: 'wsl'
          },
          label: `WSL: ${distro.name}${distro.isDefault ? ' (default)' : ''}`
        })
      })
    }

    return options
  }, [wslInfo])

  // Show shell settings on Windows (wslInfo is only set on Windows platform)
  const showShellSettings = wslInfo !== null

  const currentShellKey = getShellKey(
    shellInfoToWindowsShell(
      pendingSettings.defaultShell ?? {
        path: 'cmd.exe',
        name: 'Command Prompt',
        isDefault: true,
        kind: 'cmd'
      }
    )
  )
  return (
    <div className="flex flex-col gap-6 pb-16 max-w-2xl">
      <SettingsTitle description="Configure terminal behavior and limits">
        Terminals
      </SettingsTitle>

      {shouldShowTerminalEngineSelector(nativeCapability) && (
        <div className="settings-card rounded-2xl flex flex-col gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">
              Terminal Engine
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-1">
              Changes apply after restarting the app.
            </p>
          </div>
          <select
            aria-label="Terminal Engine"
            value={pendingSettings.terminalEngine}
            onChange={(event) => setTerminalEngine(event.target.value as 'xterm' | 'ghostty')}
            className="text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded px-3 py-2 text-[var(--mc-text-primary)]"
          >
            <option value="xterm">xterm.js</option>
            <option value="ghostty">GhosttyKit (Experimental)</option>
          </select>
        </div>
      )}

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
                type="button"
                aria-pressed={isSelected}
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
              const optionKey = getShellKey(shellInfoToWindowsShell(option.value))
              const isSelected = optionKey === currentShellKey
              return (
                <button
                  key={optionKey}
                  onClick={() => void setDefaultShell(option.value)}
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

      {/* Scrollback Lines */}
      <div className="settings-card rounded-2xl flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">
              Scrollback Lines
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-1">
              Live xterm history. Refresh keeps {formatScrollback(CANONICAL_SCROLLBACK_LINES)} canonical lines; app restart uses a separate local 3 MB raw tail.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--mc-accent)]/15 text-[var(--mc-accent)] border border-[var(--mc-accent)]/30">
            {formatScrollback(scrollbackLines)} lines
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SCROLLBACK_PRESETS.map((preset) => {
            const isSelected = scrollbackLines === preset
            return (
              <button
                key={preset}
                onClick={() => handleScrollbackPreset(preset)}
                className={`
                  relative flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold min-w-[4rem]
                  transition-all duration-200
                  ${isSelected
                    ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] shadow-lg shadow-[var(--mc-accent)]/30 scale-105'
                    : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-secondary)] hover:text-[var(--mc-text-primary)] border border-transparent hover:border-[var(--mc-accent)]/30'}
                `}
              >
                {formatScrollback(preset)}
              </button>
            )
          })}
          <button
            onClick={() => handleScrollbackPreset(customScrollback)}
            className={`
              relative flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold min-w-[4rem]
              transition-all duration-200
              ${!isScrollbackPreset
                ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] shadow-lg shadow-[var(--mc-accent)]/30 scale-105'
                : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-secondary)] hover:text-[var(--mc-text-primary)] border border-transparent hover:border-[var(--mc-accent)]/30'}
            `}
          >
            Custom
          </button>
        </div>

        {!isScrollbackPreset && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-[var(--mc-text-muted)] uppercase tracking-wide">Custom lines</span>
            <input
              type="number"
              min={SCROLLBACK_MIN}
              max={SCROLLBACK_MAX}
              step={1000}
              value={customScrollback}
              onChange={(e) => handleScrollbackCustom(e.target.value)}
              className="w-28 px-3 py-1.5 text-sm rounded-lg
                bg-[var(--mc-bg-primary)] border border-[var(--mc-accent)]/40
                text-[var(--mc-text-primary)] font-semibold
                focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50 focus:border-[var(--mc-accent)]"
              placeholder={`${SCROLLBACK_MIN}–${SCROLLBACK_MAX}`}
            />
          </div>
        )}
        {scrollbackRetentionNotice && (
          <p
            role="status"
            className="text-xs leading-relaxed rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-600 dark:text-amber-300"
          >
            {scrollbackRetentionNotice}
          </p>
        )}
      </div>

      {/* Context Window Breakdown */}
      <div className="settings-card rounded-2xl flex flex-col gap-3 p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">
            Context Window Breakdown
          </p>
          <p className="text-xs text-[var(--mc-text-muted)] mt-1">
            Drawer that estimates how your active Claude session is spending its
            context budget across six categories (CLAUDE.md, tool output, thinking, etc.).
          </p>
        </div>
        <div className="flex items-start gap-3 pt-1">
          <ToggleSwitch
            ariaLabel="Enable context window breakdown"
            checked={pendingSettings.enableContextWindow !== false}
            onChange={setEnableContextWindow}
          />
          <div>
            <p
              className="text-sm font-medium text-[var(--mc-text-primary)]"
              title="Requires restart to take effect"
            >
              Enable context window breakdown
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">
              Turning this off skips the JSONL analyzer and hides the drawer —
              <span className="font-semibold"> requires restart</span> to take effect.
            </p>
          </div>
        </div>

        {/* Advanced features — nested under master */}
        <div className="flex items-start gap-3 pt-3 pl-6 border-l-2 border-[var(--mc-border)]/60">
          <ToggleSwitch
            ariaLabel="Advanced features"
            checked={Boolean(pendingSettings.enableContextWindowAdvanced)}
            onChange={setEnableContextWindowAdvanced}
            disabled={pendingSettings.enableContextWindow === false}
          />
          <div>
            <p
              className="text-sm font-medium text-[var(--mc-text-primary)]"
              title="Requires restart to take effect"
            >
              Advanced features
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">
              Turn-injection diff · Tool activity · Compaction timeline · Extended thinking.
              <span className="font-semibold"> Requires restart.</span>
            </p>
          </div>
        </div>

      </div>

    </div>
  )
}
