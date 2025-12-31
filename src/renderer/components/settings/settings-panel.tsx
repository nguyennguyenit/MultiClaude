import { ThemeSelector } from './theme-selector'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  return (
    <div className="border-t border-[var(--mc-border)] bg-[var(--mc-bg-secondary)] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--mc-text-primary)]">Settings</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ThemeSelector />
    </div>
  )
}
