import { DiffRenderer } from './diff-renderer'

interface DiffViewerProps {
  diff: string | null
  fileName: string | null
}

export function DiffViewer({ diff, fileName }: DiffViewerProps) {
  if (!diff || !fileName) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-[var(--mc-text-muted)]">
        Select a file to view diff
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--mc-border)] bg-[var(--mc-bg-primary)]">
      <div className="border-b border-[var(--mc-border)] bg-[var(--mc-bg-secondary)]/25 p-3 text-xs text-[var(--mc-text-muted)]">
        {fileName}
      </div>
      <DiffRenderer diff={diff} />
    </div>
  )
}
