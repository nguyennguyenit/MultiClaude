import { useEffect, useState } from 'react'

interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** Optional extra content rendered in the header, between the title and close button */
  headerExtra?: React.ReactNode
  children: React.ReactNode
}

/** Generic slide panel that overlays from right (landscape) or bottom (portrait) */
export function SlidePanel({ isOpen, onClose, title, headerExtra, children }: SlidePanelProps) {
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  )

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Escape key closes active panel
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const dirClass = isPortrait ? 'slide-panel-bottom' : 'slide-panel-right'
  const openClass = isOpen ? 'slide-panel-open' : ''

  return (
    <div
      className={`slide-panel ${dirClass} ${openClass}`}
      // visibility:hidden preserves child state (data, form state) when closed
      style={{ visibility: isOpen ? 'visible' : 'hidden' }}
    >
      <div className="slide-panel-header">
        <span className="slide-panel-title">{title}</span>
        {headerExtra && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {headerExtra}
          </div>
        )}
        <button className="slide-panel-close" onClick={onClose} title="Close (Esc)">
          ×
        </button>
      </div>
      <div className="slide-panel-body">
        {children}
      </div>
    </div>
  )
}
