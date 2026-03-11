import { useEffect } from 'react'
import { getStatusColor, getStatusLabel } from './git-file-utils'

interface DiffModalProps {
  isOpen: boolean
  onClose: () => void
  fileName: string | null
  fileStatus?: string
  additions?: number
  deletions?: number
  diff: string | null
  staged?: boolean
}

export function DiffModal({
  isOpen,
  onClose,
  fileName,
  fileStatus,
  additions,
  deletions,
  diff
}: DiffModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen || !fileName) return null

  const lines = diff ? diff.split('\n') : []
  const baseName = fileName.split(/[/\\]/).pop() || fileName
  const dirName = fileName.split(/[/\\]/).slice(0, -1).join('/') || '.'

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative flex flex-col bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded-lg shadow-2xl"
        style={{ width: '90vw', height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--mc-border)] flex-shrink-0">
          {/* Status badge */}
          <span className={`font-mono text-xs font-bold ${getStatusColor(fileStatus)}`}>
            {getStatusLabel(fileStatus)}
          </span>

          {/* File path */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-[var(--mc-text-primary)]">{baseName}</span>
            <span className="text-xs text-[var(--mc-text-muted)] ml-2">{dirName}</span>
          </div>

          {/* Line stats */}
          {(additions !== undefined || deletions !== undefined) && (
            <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
              {additions !== undefined && additions > 0 && (
                <span className="text-green-400">+{additions}</span>
              )}
              {deletions !== undefined && deletions > 0 && (
                <span className="text-red-400">-{deletions}</span>
              )}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--mc-bg-tertiary)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          {!diff ? (
            <div className="flex items-center justify-center h-full text-xs text-[var(--mc-text-muted)]">
              Loading diff...
            </div>
          ) : lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-[var(--mc-text-muted)]">
              No diff available
            </div>
          ) : (
            <pre className="p-3 text-xs font-mono leading-tight">
              {lines.map((line, i) => {
                let className = 'block'
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  className = 'block text-green-400 bg-green-900/20'
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  className = 'block text-red-400 bg-red-900/20'
                } else if (line.startsWith('@@')) {
                  className = 'block text-blue-400'
                } else {
                  className = 'block text-[var(--mc-text-secondary)]'
                }
                return (
                  <span key={i} className={className}>
                    {line || ' '}
                  </span>
                )
              })}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
