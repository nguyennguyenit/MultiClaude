import { useSettingsStore } from '../../stores'
import { TERMINAL_COLOR_PRESETS, TERMINAL_FONTS, type TerminalColorPresetConfig } from '@shared/constants'
import type { TerminalFontId } from '@shared/types'
import { SettingsSubheading } from './settings-typography'
import { getFontFamily } from '../../utils'

/**
 * Terminal style customization options component.
 * Only shown when uiStyle === 'terminal' in settings.
 */
export function TerminalStyleOptions() {
  const { pendingSettings, setTerminalStyleOptions } = useSettingsStore()
  const options = pendingSettings.terminalStyleOptions ?? {
    colorPreset: 'green',
    fontFamily: 'jetbrains-mono',
    useBorderChars: false
  }

  return (
    <div className="space-y-4">
      {/* Color Preset */}
      <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
        <SettingsSubheading>Terminal Color Preset</SettingsSubheading>
        <div className="mt-3 flex gap-2 flex-wrap">
          {Object.values(TERMINAL_COLOR_PRESETS).map((preset) => (
            <ColorPresetCard
              key={preset.id}
              preset={preset}
              selected={options.colorPreset === preset.id}
              onClick={() => setTerminalStyleOptions({ colorPreset: preset.id })}
            />
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
        <SettingsSubheading>Terminal Font</SettingsSubheading>
        <label htmlFor="terminal-font-select" className="sr-only">
          Select terminal font
        </label>
        <select
          id="terminal-font-select"
          value={options.fontFamily}
          onChange={(e) => setTerminalStyleOptions({ fontFamily: e.target.value as TerminalFontId })}
          className="mt-3 w-full p-2.5 text-sm border border-[var(--mc-border)] bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)] rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
        >
          {TERMINAL_FONTS.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
              {font.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-[var(--mc-text-muted)]">
          Preview: <span style={{ fontFamily: getFontFamily(options.fontFamily) }}>The quick brown fox</span>
        </p>
      </div>

      {/* Border Style */}
      <div className="p-4 rounded-lg bg-[var(--mc-bg-secondary)]/30 border border-[var(--mc-border)]">
        <SettingsSubheading>Border Style</SettingsSubheading>
        <div className="mt-3 flex gap-3">
          <BorderStyleCard
            label="1px Solid"
            description="Clean minimal borders"
            preview="┃"
            selected={!options.useBorderChars}
            onClick={() => setTerminalStyleOptions({ useBorderChars: false })}
          />
          <BorderStyleCard
            label="ASCII Box"
            description="Classic terminal ┌─┐"
            preview="╔═╗"
            selected={options.useBorderChars}
            onClick={() => setTerminalStyleOptions({ useBorderChars: true })}
          />
        </div>
      </div>
    </div>
  )
}

// Color preset card component
function ColorPresetCard({
  preset,
  selected,
  onClick
}: {
  preset: TerminalColorPresetConfig
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Select ${preset.name} color preset`}
      aria-pressed={selected}
      className={`
        flex flex-col items-center gap-2 px-5 py-4 rounded-lg border-2 min-w-[100px] transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50
        ${selected
          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
      `}
    >
      {/* Color preview */}
      <div
        className="w-full h-10 rounded-md flex items-center justify-center text-base font-mono"
        style={{
          backgroundColor: preset.bg,
          color: preset.text,
          border: `1px solid ${preset.border}`
        }}
      >
        {'>_'}
      </div>
      <span className="text-sm font-medium flex items-center gap-1">
        {preset.name}
        {selected && <span style={{ color: preset.text }}>✓</span>}
      </span>
    </button>
  )
}

// Border style card component
function BorderStyleCard({
  label,
  description,
  preview,
  selected,
  onClick
}: {
  label: string
  description: string
  preview: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Select ${label} border style`}
      aria-pressed={selected}
      className={`
        flex-1 flex flex-col gap-1 px-4 py-3 rounded-lg border-2 text-left transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50
        ${selected
          ? 'border-[var(--mc-accent)] bg-[var(--mc-bg-active)]'
          : 'border-[var(--mc-border)] hover:border-[var(--mc-accent)]/50'}
      `}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          {label}
          {selected && <span className="text-[var(--mc-accent)]">✓</span>}
        </span>
        <span className="font-mono text-[var(--mc-text-muted)]">{preview}</span>
      </div>
      <span className="text-xs text-[var(--mc-text-muted)]">{description}</span>
    </button>
  )
}
