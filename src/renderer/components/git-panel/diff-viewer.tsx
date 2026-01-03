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

  const lines = diff.split('\n')

  return (
    <div className="flex-1 overflow-auto bg-[var(--mc-bg-primary)] border-t border-[var(--mc-border)]">
      <div className="p-2 text-xs border-b border-[var(--mc-border)] text-[var(--mc-text-muted)]">
        {fileName}
      </div>
      <pre className="p-2 text-xs font-mono leading-tight overflow-x-auto">
        {lines.map((line, i) => {
          let className = ''
          if (line.startsWith('+') && !line.startsWith('+++')) {
            className = 'text-green-400 bg-green-900/20'
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            className = 'text-red-400 bg-red-900/20'
          } else if (line.startsWith('@@')) {
            className = 'text-blue-400'
          }
          return (
            <div key={i} className={className}>
              {line || ' '}
            </div>
          )
        })}
      </pre>
    </div>
  )
}
