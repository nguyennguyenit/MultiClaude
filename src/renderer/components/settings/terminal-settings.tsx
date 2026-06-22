import { useState, useEffect, useMemo } from 'react'
import { useSettingsStore } from '../../stores'
import { getShellKey } from '../../utils'
import type { TerminalLimitPreset, TerminalRenderMode, WindowsShell } from '@shared/types'
import { SCROLLBACK_DEFAULT, SCROLLBACK_MIN, SCROLLBACK_MAX, SCROLLBACK_PRESETS } from '@shared/constants'
import { SettingsTitle } from './settings-typography'
import { ToggleSwitch } from './toggle-switch'

function formatScrollback(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return `${value}`
}

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

const CLAUDE_RENDERER_HELPER_COPY = {
  performance: {
    badge: 'GPU unavailable',
    description: 'Performance mode disables GPU rendering for all terminals.',
    tooltip: 'Switch to Balanced or Quality to choose whether Claude terminals can use GPU rendering.',
    toggleDescription: 'Unavailable in Performance mode because GPU rendering is off for all terminals.',
    disabled: true
  },
  safe: {
    badge: 'Claude-safe mode',
    description: 'Claude terminals stay on the safer canvas renderer.',
    tooltip: 'Balanced and Quality still use WebGL for non-Claude terminals. Turn on the experimental switch below to let Claude terminals use GPU rendering too.',
    toggleDescription: 'Experimental. When disabled, Claude terminals always use the safer canvas renderer.',
    disabled: false
  },
  followMode: {
    badge: 'Claude follows mode',
    description: 'Claude terminals use the selected render mode.',
    tooltip: 'Performance keeps canvas everywhere. Balanced uses WebGL for the active terminal. Quality uses WebGL for all visible terminals.',
    toggleDescription: 'Experimental. When enabled, Claude terminals use the selected GPU render mode.',
    disabled: false
  }
} as const

export function getClaudeRendererControlState(
  terminalRenderMode: TerminalRenderMode,
  gpuRendererForClaudeTerminals: boolean | undefined
) {
  if (terminalRenderMode === 'performance') {
    return CLAUDE_RENDERER_HELPER_COPY.performance
  }

  return gpuRendererForClaudeTerminals
    ? CLAUDE_RENDERER_HELPER_COPY.followMode
    : CLAUDE_RENDERER_HELPER_COPY.safe
}

export function TerminalSettings() {
  const {
    pendingSettings,
    wslInfo,
    setTerminalLimit,
    setTerminalRenderMode,
    setGpuRendererForClaudeTerminals,
    setScrollbackLines,
    setEnableContextWindow,
    setEnableContextWindowAdvanced,
    setEnableThinkingSyntaxHighlight,
    setReflowSafeScrollback,
    setWindowsShell
  } = useSettingsStore()
  const { terminalLimit } = pendingSettings
  const scrollbackLines = pendingSettings.scrollbackLines ?? SCROLLBACK_DEFAULT
  const isScrollbackPreset = (SCROLLBACK_PRESETS as readonly number[]).includes(scrollbackLines)
  const [customScrollback, setCustomScrollback] = useState(
    isScrollbackPreset ? SCROLLBACK_DEFAULT : scrollbackLines
  )

  // Keep custom input in sync if user enters a non-preset value via external save
  useEffect(() => {
    if (!isScrollbackPreset) setCustomScrollback(scrollbackLines)
  }, [scrollbackLines, isScrollbackPreset])

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
  const claudeRendererHelper = getClaudeRendererControlState(
    pendingSettings.terminalRenderMode,
    pendingSettings.gpuRendererForClaudeTerminals
  )

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

        <div
          title={claudeRendererHelper.tooltip}
          className="flex items-start gap-3 rounded-xl border border-[var(--mc-border)]/70 bg-[var(--mc-bg-hover)]/70 px-3.5 py-3"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-1 rounded-full bg-[var(--mc-accent)]/15 text-[var(--mc-accent)] border border-[var(--mc-accent)]/30">
            {claudeRendererHelper.badge}
          </span>
          <p className="text-xs leading-relaxed text-[var(--mc-text-muted)]">
            {claudeRendererHelper.description}
          </p>
        </div>

        <div className="pt-2 border-t border-[var(--mc-border)]/70 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={Boolean(pendingSettings.gpuRendererForClaudeTerminals)}
              onChange={setGpuRendererForClaudeTerminals}
              disabled={claudeRendererHelper.disabled}
            />
            <div>
              <p className="text-sm font-medium text-[var(--mc-text-primary)]">
                Use GPU renderer for Claude terminals
              </p>
              <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">
                {claudeRendererHelper.toggleDescription}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollback Lines */}
      <div className="settings-card rounded-2xl flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">
              Scrollback Lines
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-1">
              How far back you can scroll in each terminal. Higher values use more memory (~1–2KB per line).
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
      </div>

      {/* Auto-rebuild scrollback on resize (Part D) */}
      <div className="settings-card rounded-2xl flex flex-col gap-3 p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--mc-text-primary)] uppercase tracking-wider">
            Auto-rebuild Scrollback on Resize
          </p>
          <p className="text-xs text-[var(--mc-text-muted)] mt-1">
            The Refresh button rebuilds scrollback from the raw PTY transcript to
            eliminate xterm reflow artifacts. Enable this option to also do it
            automatically after non-drag terminal width changes, such as window
            resize or project switch. Adds ~100-300ms CPU per rebuild.
          </p>
        </div>
        <div className="flex items-start gap-3 pt-1">
          <ToggleSwitch
            checked={Boolean(pendingSettings.reflowSafeScrollback)}
            onChange={setReflowSafeScrollback}
          />
          <div>
            <p className="text-sm font-medium text-[var(--mc-text-primary)]">
              Enable auto-rebuild on width change
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">
              Off by default; pane divider drags resize live without replaying the
              terminal buffer.
            </p>
          </div>
        </div>
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
              Turn-injection diff · Execution trace · Compaction timeline · Extended thinking.
              <span className="font-semibold"> Requires restart.</span>
            </p>
          </div>
        </div>

        {/* Thinking syntax highlight — nested under advanced */}
        <div className="flex items-start gap-3 pt-2 pl-12 border-l-2 border-[var(--mc-border)]/60">
          <ToggleSwitch
            checked={Boolean(pendingSettings.enableThinkingSyntaxHighlight)}
            onChange={setEnableThinkingSyntaxHighlight}
            disabled={
              pendingSettings.enableContextWindow === false ||
              !pendingSettings.enableContextWindowAdvanced
            }
          />
          <div>
            <p
              className="text-sm font-medium text-[var(--mc-text-primary)]"
              title="Requires restart. Loads a ~25KB code-highlight chunk on first expand."
            >
              Thinking syntax highlighting
            </p>
            <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">
              Lazy-loads a ~25KB highlighter chunk only when a thinking block is expanded.
              <span className="font-semibold"> Requires restart.</span>
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
