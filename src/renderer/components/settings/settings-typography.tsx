// Shared typography components for consistent styling across Settings tabs
import type { ReactNode } from 'react'

interface SettingsTitleProps {
  children: ReactNode
  description?: string
}

export function SettingsTitle({ children, description }: SettingsTitleProps) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-[var(--mc-text-primary)]">{children}</h3>
      {description && (
        <p className="text-sm text-[var(--mc-text-muted)] mt-1">{description}</p>
      )}
      <hr className="my-5 border-[var(--mc-border)]" />
    </div>
  )
}

export function SettingsSubheading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase text-[var(--mc-text-muted)] mb-5 tracking-wider">
      {children}
    </h4>
  )
}
