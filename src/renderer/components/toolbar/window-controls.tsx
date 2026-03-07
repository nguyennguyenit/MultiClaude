import { useCallback } from 'react'

export function WindowControls() {
  const handleMinimize = useCallback(() => {
    window.electron.window.minimize()
  }, [])

  const handleMaximize = useCallback(() => {
    window.electron.window.maximize()
  }, [])

  const handleClose = useCallback(() => {
    window.electron.window.close()
  }, [])

  return (
    <div className="window-controls">
      <button 
        type="button" 
        className="window-control-btn window-control-minimize" 
        onClick={handleMinimize}
        title="Minimize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2" y1="6" x2="10" y2="6" strokeLinecap="round" />
        </svg>
      </button>
      
      <button 
        type="button" 
        className="window-control-btn window-control-maximize" 
        onClick={handleMaximize}
        title="Maximize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2.5" y="2.5" width="7" height="7" />
        </svg>
      </button>

      <button 
        type="button" 
        className="window-control-btn window-control-close" 
        onClick={handleClose}
        title="Close"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" strokeLinecap="round" />
          <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
