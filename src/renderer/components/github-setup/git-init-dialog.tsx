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

  return (
    <div className="dialog-backdrop">
      <div className="dialog git-init-dialog">
        <div className="dialog-header git-init-dialog-header">
          <div className="git-init-dialog-title-group">
            <span className="git-init-dialog-kicker">Quick Setup</span>
            <span className="git-init-dialog-title">Git Repository Required</span>
          </div>
          <button onClick={onClose} className="slide-panel-close" title="Close">×</button>
        </div>

        <div className="dialog-body git-init-dialog-body">
          <div className="git-init-hero">
            <div className="git-init-hero-icon" aria-hidden="true">
              <WarningIcon />
            </div>
            <div className="git-init-hero-copy">
              <span className="git-init-hero-label">Git not detected</span>
              <h3 className="git-init-hero-title">{projectName || 'This project'} is not a repository yet</h3>
              <p className="git-init-hero-text">
                Initialize Git now so commits, branches, history, and GitHub setup work immediately.
              </p>
            </div>
          </div>

          <div className="git-init-project-card">
            <span className="git-init-project-label">Project path</span>
            <code className="git-init-project-path">{projectPath}</code>
          </div>

          <div className="git-init-steps">
            <div className="git-init-step">
              <span className="git-init-step-number">1</span>
              <div className="git-init-step-copy">
                <span className="git-init-step-title">Initialize a new repository</span>
                <span className="git-init-step-text">Create the local `.git` metadata in this folder.</span>
              </div>
            </div>
            <div className="git-init-step">
              <span className="git-init-step-number">2</span>
              <div className="git-init-step-copy">
                <span className="git-init-step-title">Create the initial commit</span>
                <span className="git-init-step-text">Capture the current files so the project is ready to sync or share.</span>
              </div>
            </div>
          </div>

          <div className="git-init-manual">
            <button
              onClick={() => setShowManual(!showManual)}
              className="git-init-manual-toggle"
              aria-expanded={showManual}
            >
              <div className="git-init-manual-copy">
                <span className="git-init-manual-title">Prefer to do it manually?</span>
                <span className="git-init-manual-text">Show the exact commands for this folder.</span>
              </div>
              <span className={`git-init-manual-chevron${showManual ? ' expanded' : ''}`} aria-hidden="true">
                ▾
              </span>
            </button>
            {showManual && (
              <div className="dialog-code git-init-code">
                <div>cd &quot;{projectPath}&quot;</div>
                <div>git init</div>
                <div>git add .</div>
                <div>git commit -m &quot;Initial commit&quot;</div>
              </div>
            )}
          </div>

          <div className="git-init-preference">
            <label className="git-init-checkbox">
              <input
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span>Don&apos;t ask again for this project</span>
            </label>
          </div>
        </div>

        <div className="dialog-footer">
          <button onClick={() => onSkip(dontAskAgain)} className="dialog-btn">
            Skip for now
          </button>
          <button onClick={handleInitialize} disabled={isInitializing} className="dialog-btn dialog-btn-primary">
            {isInitializing ? 'Initializing...' : 'Initialize Git'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01m-7.938 4h15.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L2.33 17c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}
