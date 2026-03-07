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
  projectName: _projectName,
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
      <div className="dialog">
        {/* Header */}
        <div className="dialog-header">
          <span>Git Repository Required</span>
          <button onClick={onClose} className="slide-panel-close" title="Close">×</button>
        </div>

        {/* Body */}
        <div className="dialog-body">
          {/* Warning */}
          <div className="dialog-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e0af68" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span style={{ color: 'var(--text-primary)' }}>This folder is not a git repository.</span>
          </div>

          {/* Description */}
          <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>We'll set up git for you:</p>
          <ul style={{ color: 'var(--text-muted)', paddingLeft: '16px', marginBottom: '12px', lineHeight: '1.8' }}>
            <li>Initialize a new git repository</li>
            <li>Create an initial commit</li>
          </ul>

          {/* Manual instructions collapsible */}
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => setShowManual(!showManual)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', padding: 0 }}
            >
              {showManual ? '▾' : '▸'} Prefer to do it manually?
            </button>
            {showManual && (
              <div className="dialog-code" style={{ marginTop: '6px' }}>
                <div>cd "{projectPath}"</div>
                <div>git init</div>
                <div>git add .</div>
                <div>git commit -m "Initial commit"</div>
              </div>
            )}
          </div>

          {/* Don't ask again */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            Don't ask again for this project
          </label>
        </div>

        {/* Footer */}
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
