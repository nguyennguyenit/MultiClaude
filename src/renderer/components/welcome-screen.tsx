interface WelcomeScreenProps {
  onAddProject: () => void
}

export function WelcomeScreen({ onAddProject }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--mc-bg-primary)] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--mc-accent)]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center relative z-10 max-w-lg px-8">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[var(--mc-bg-tertiary)] to-[var(--mc-bg-secondary)] border border-[var(--mc-border)] flex items-center justify-center shadow-lg group">
            <svg className="w-10 h-10 text-[var(--mc-accent)] transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-[var(--mc-text-primary)] to-[var(--mc-text-secondary)] bg-clip-text text-transparent">
          Welcome to MultiClaude
        </h1>
        <p className="text-[var(--mc-text-secondary)] mb-8 text-base leading-relaxed">
          Multi-agent terminal manager for Claude Code. Run multiple instances, manage projects, and integrate with Git.
        </p>

        {/* Add Project Button */}
        <button
          onClick={onAddProject}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] font-semibold rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[var(--mc-accent)]/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Project
        </button>

        {/* Keyboard Shortcut Hint */}
        <p className="mt-8 text-sm text-[var(--mc-text-muted)]">
          or press <kbd className="px-2 py-0.5 bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] rounded-md text-sm font-mono text-[var(--mc-text-primary)] shadow-sm">Ctrl+Shift+P</kbd> to open folder
        </p>

        {/* Features List */}
        <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-4 text-left text-sm">
          <div className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--mc-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--mc-bg-secondary)] transition-colors">
              <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[var(--mc-text-secondary)]">Multiple terminals</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--mc-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--mc-bg-secondary)] transition-colors">
              <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[var(--mc-text-secondary)]">Git integration</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--mc-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--mc-bg-secondary)] transition-colors">
              <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[var(--mc-text-secondary)]">Session persistence</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--mc-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--mc-bg-secondary)] transition-colors">
              <svg className="w-4 h-4 text-[var(--mc-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[var(--mc-text-secondary)]">Theme customization</span>
          </div>
        </div>
      </div>
    </div>
  )
}
