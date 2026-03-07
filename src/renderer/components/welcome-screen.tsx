interface WelcomeScreenProps {
  onAddProject: () => void
}

export function WelcomeScreen({ onAddProject }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen" style={{ flex: 1 }}>
      <div className="welcome-icon">$_</div>
      <h1 className="welcome-title">MultiClaude</h1>
      <p className="welcome-hint">
        Multi-agent terminal manager for Claude Code.
        <br />
        Open a project folder to get started.
      </p>
      <button type="button" onClick={onAddProject} className="welcome-btn">
        + Add Project
      </button>
      <p className="welcome-hint" style={{ marginTop: 0, fontSize: '12px' }}>
        <kbd>Ctrl+T</kbd> new terminal &nbsp;·&nbsp; <kbd>Ctrl+B</kbd> git panel &nbsp;·&nbsp; <kbd>Alt+1–9</kbd> switch project
      </p>
    </div>
  )
}
