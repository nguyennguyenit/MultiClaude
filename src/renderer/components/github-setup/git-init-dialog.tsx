import { useState } from 'react'

interface GitInitDialogProps {
  isOpen: boolean
  projectName: string
  projectPath: string
  onInitialize: () => Promise<void>
  onSkip: (dontAskAgain: boolean) => void
  onClose: () => void
}

export function GitInitDialog({
  isOpen,
  projectName,
  projectPath,
  onInitialize,
  onSkip,
  onClose
}: GitInitDialogProps) {
  const [isInitializing, setIsInitializing] = useState(false)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const [showManual, setShowManual] = useState(false)

  if (!isOpen) return null

  const handleInitialize = async () => {
    setIsInitializing(true)
    try {
      await onInitialize()
    } finally {
      setIsInitializing(false)
    }
  }

  const handleSkip = () => {
    onSkip(dontAskAgain)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--mc-bg-secondary)] rounded-lg p-5 w-[420px] max-w-[90vw] shadow-xl border border-[var(--mc-border)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranchIcon />
            <h3 className="text-base font-medium text-[var(--mc-text-primary)]">
              Git Repository Required
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--mc-bg-hover)] rounded transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded mb-4">
          <WarningIcon />
          <p className="text-sm text-[var(--mc-text-primary)]">
            This folder is not a git repository
          </p>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p className="text-sm text-[var(--mc-text-muted)] mb-2">
            We'll set up git for you:
          </p>
          <ul className="text-sm text-[var(--mc-text-muted)] space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <CheckIcon />
              Initialize a new git repository
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Create an initial commit
            </li>
          </ul>
        </div>

        {/* Manual Instructions (Collapsible) */}
        <div className="mb-4">
          <button
            onClick={() => setShowManual(!showManual)}
            className="flex items-center gap-1 text-xs text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-colors"
          >
            <ChevronIcon expanded={showManual} />
            Prefer to do it manually?
          </button>
          {showManual && (
            <div className="mt-2 p-2 bg-[var(--mc-bg-primary)] rounded text-xs font-mono text-[var(--mc-text-muted)] border border-[var(--mc-border)]">
              <div>cd "{projectPath}"</div>
              <div>git init</div>
              <div>git add .</div>
              <div>git commit -m "Initial commit"</div>
            </div>
          )}
        </div>

        {/* Don't ask again checkbox */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--mc-border)] bg-[var(--mc-bg-primary)] accent-[var(--mc-accent)]"
          />
          <span className="text-xs text-[var(--mc-text-muted)]">
            Don't ask again for this project
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)] transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={handleInitialize}
            disabled={isInitializing}
            className="px-4 py-2 text-sm bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-opacity"
          >
            {isInitializing ? (
              <>
                <SpinnerIcon />
                Initializing...
              </>
            ) : (
              <>
                <GitBranchIcon small />
                Initialize Git
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Icons
function GitBranchIcon({ small }: { small?: boolean }) {
  const size = small ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 7a2 2 0 104 0 2 2 0 00-4 0zm0 10a2 2 0 104 0 2 2 0 00-4 0zm10-4a2 2 0 104 0 2 2 0 00-4 0zM9 7v10m4-4h4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
