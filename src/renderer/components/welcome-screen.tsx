interface WelcomeScreenProps {
  onAddProject: () => void
}

export function WelcomeScreen({ onAddProject }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--mc-bg-primary)]">
      <div className="text-center max-w-md px-8">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-[var(--mc-accent)] flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--mc-bg-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[var(--mc-text-primary)] mb-2">
          Welcome to MultiClaude
        </h1>
        <p className="text-[var(--mc-text-secondary)] mb-8">
          Multi-agent terminal manager for Claude Code. Run multiple instances, manage projects, and integrate with Git.
        </p>

        {/* Add Project Button */}
        <button
          onClick={onAddProject}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Project
        </button>

        {/* Keyboard Shortcut Hint */}
        <p className="mt-6 text-sm text-[var(--mc-text-muted)]">
          or press <kbd className="px-2 py-0.5 bg-[var(--mc-bg-tertiary)] rounded text-xs">Ctrl+Shift+P</kbd> to open folder
        </p>

        {/* Features List */}
        <div className="mt-10 grid grid-cols-2 gap-4 text-left text-sm">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[var(--mc-accent)] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[var(--mc-text-secondary)]">Multiple terminals</span>
          </div>
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[var(--mc-accent)] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[var(--mc-text-secondary)]">Git integration</span>
          </div>
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[var(--mc-accent)] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[var(--mc-text-secondary)]">Session persistence</span>
          </div>
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[var(--mc-accent)] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[var(--mc-text-secondary)]">Theme customization</span>
          </div>
        </div>
      </div>
    </div>
  )
}
