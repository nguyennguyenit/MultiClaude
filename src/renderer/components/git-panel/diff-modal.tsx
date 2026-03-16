import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DiffRenderer } from './diff-renderer'
import { getStatusColor, getStatusLabel } from './git-file-utils'

interface DiffModalProps {
  isOpen: boolean
  onClose: () => void
  fileName: string | null
  oldFileName?: string
  fileStatus?: string
  additions?: number
  deletions?: number
  diff: string | null
  isLoading?: boolean
  error?: string
  sourceLabel?: string
  staged?: boolean
}

export function DiffModal({
  isOpen,
  onClose,
  fileName,
  oldFileName,
  fileStatus,
  additions,
  deletions,
  diff,
  isLoading = false,
  error,
  sourceLabel
}: DiffModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen || !fileName) return null

  const baseName = fileName.split(/[/\\]/).pop() || fileName
  const dirName = fileName.split(/[/\\]/).slice(0, -1).join('/') || 'Repository root'
  const oldDirName = oldFileName ? (oldFileName.split(/[/\\]/).slice(0, -1).join('/') || '.') : null
  const oldBaseName = oldFileName?.split(/[/\\]/).pop() || oldFileName
  const statusColor = getStatusColor(fileStatus)
  const statusText = fileStatus ? `${fileStatus.slice(0, 1).toUpperCase()}${fileStatus.slice(1)}` : 'Changed'

  const modalContent = (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-primary)] shadow-2xl"
        style={{ width: 'min(98vw, 1440px)', height: 'min(94vh, 1040px)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-modal-title"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3 border-b border-[var(--mc-border)] bg-[var(--mc-bg-secondary)]/25 px-5 py-4">
          {/* Status badge */}
          <span className={`inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-bg-primary)]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusColor}`}>
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              {getStatusLabel(fileStatus)}
            </span>
            <span>{statusText}</span>
          </span>

          {/* File path */}
          <div className="flex-1 min-w-0">
            <div id="diff-modal-title" className="truncate text-base font-semibold text-[var(--mc-text-primary)]">
              {baseName}
            </div>
            <div className="mt-1 text-xs text-[var(--mc-text-muted)] truncate">
              {dirName}
            </div>
            {oldFileName && (
              <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--mc-border)]/80 bg-[var(--mc-bg-primary)]/45 px-2.5 py-1 text-[11px] text-[var(--mc-text-muted)]">
                <span className="uppercase tracking-[0.08em] text-[10px]">From</span>
                <span className="truncate text-[var(--mc-text-primary)]">
                  {oldBaseName}
                  {oldDirName ? ` (${oldDirName})` : ''}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {(additions !== undefined || deletions !== undefined) && (
              <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
                {additions !== undefined && additions > 0 && (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                    +{additions}
                  </span>
                )}
                {deletions !== undefined && deletions > 0 && (
                  <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-1 text-rose-300">
                    -{deletions}
                  </span>
                )}
              </div>
            )}

            {sourceLabel && (
              <span className="flex-shrink-0 rounded-full border border-[var(--mc-border)] bg-[var(--mc-bg-primary)]/50 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--mc-text-muted)]">
                {sourceLabel}
              </span>
            )}

            <span className="rounded-full border border-[var(--mc-border)] bg-[var(--mc-bg-primary)]/50 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--mc-text-muted)]">
              Esc
            </span>

            {/* Close button */}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
              aria-label="Close diff modal"
              title="Close diff (Esc)"
              style={{
                border: '1px solid rgba(251, 113, 133, 0.38)',
                background: 'rgba(244, 63, 94, 0.14)',
                color: '#fecdd3',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.18)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(251, 113, 133, 0.6)'
                e.currentTarget.style.background = 'rgba(244, 63, 94, 0.24)'
                e.currentTarget.style.color = '#fff1f2'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(251, 113, 133, 0.38)'
                e.currentTarget.style.background = 'rgba(244, 63, 94, 0.14)'
                e.currentTarget.style.color = '#fecdd3'
              }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="flex items-center gap-3 rounded-full border border-[var(--mc-border)] bg-[var(--mc-bg-secondary)]/30 px-4 py-2 text-sm text-[var(--mc-text-muted)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--mc-accent)]" />
                Loading diff...
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="max-w-md rounded-2xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-center text-sm text-rose-200">
                {error}
              </div>
            </div>
          ) : !diff ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--mc-text-muted)]">
              No diff available
            </div>
          ) : (
            <DiffRenderer diff={diff} />
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return modalContent
  }

  return createPortal(modalContent, document.body)
}
