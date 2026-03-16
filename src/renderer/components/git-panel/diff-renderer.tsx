interface ParsedDiffLine {
  kind: 'meta' | 'hunk' | 'context' | 'addition' | 'deletion' | 'note'
  raw: string
  display: string
  marker: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

interface ParsedDiffSummary {
  additions: number
  deletions: number
  hunks: number
  files: number
}

interface ParsedDiff {
  lines: ParsedDiffLine[]
  summary: ParsedDiffSummary
}

interface DiffRendererProps {
  diff: string | null
  emptyLabel?: string
}

const DIFF_META_PREFIXES = [
  'diff --git ',
  'index ',
  '--- ',
  '+++ ',
  'Binary files ',
  'new file mode ',
  'deleted file mode ',
  'old mode ',
  'new mode ',
  'similarity index ',
  'rename from ',
  'rename to ',
  'copy from ',
  'copy to '
]

function isMetaLine(line: string): boolean {
  return DIFF_META_PREFIXES.some(prefix => line.startsWith(prefix))
}

function trimTrailingNewline(diff: string): string {
  return diff.endsWith('\n') ? diff.slice(0, -1) : diff
}

function stripDiffPrefix(line: string): string {
  return line.length > 1 ? line.slice(1) : ''
}

export function parseUnifiedDiff(diff: string): ParsedDiff {
  const normalizedDiff = trimTrailingNewline(diff)
  const rawLines = normalizedDiff ? normalizedDiff.split('\n') : []
  const lines: ParsedDiffLine[] = []

  let oldLine = 0
  let newLine = 0
  let additions = 0
  let deletions = 0
  let hunks = 0
  let files = 0

  for (const line of rawLines) {
    if (line.startsWith('diff --git ')) {
      files += 1
      lines.push({
        kind: 'meta',
        raw: line,
        display: line,
        marker: '',
        oldLineNumber: null,
        newLineNumber: null
      })
      continue
    }

    if (line.startsWith('@@')) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = Number(match[1])
        newLine = Number(match[2])
      }
      hunks += 1
      lines.push({
        kind: 'hunk',
        raw: line,
        display: line,
        marker: '@@',
        oldLineNumber: null,
        newLineNumber: null
      })
      continue
    }

    if (line.startsWith('\\')) {
      lines.push({
        kind: 'note',
        raw: line,
        display: line,
        marker: '!',
        oldLineNumber: null,
        newLineNumber: null
      })
      continue
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      lines.push({
        kind: 'addition',
        raw: line,
        display: stripDiffPrefix(line),
        marker: '+',
        oldLineNumber: null,
        newLineNumber: newLine > 0 ? newLine : null
      })
      newLine += 1
      additions += 1
      continue
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      lines.push({
        kind: 'deletion',
        raw: line,
        display: stripDiffPrefix(line),
        marker: '-',
        oldLineNumber: oldLine > 0 ? oldLine : null,
        newLineNumber: null
      })
      oldLine += 1
      deletions += 1
      continue
    }

    if (line.startsWith(' ')) {
      lines.push({
        kind: 'context',
        raw: line,
        display: stripDiffPrefix(line),
        marker: '',
        oldLineNumber: oldLine > 0 ? oldLine : null,
        newLineNumber: newLine > 0 ? newLine : null
      })
      oldLine += 1
      newLine += 1
      continue
    }

    if (isMetaLine(line)) {
      lines.push({
        kind: 'meta',
        raw: line,
        display: line,
        marker: '',
        oldLineNumber: null,
        newLineNumber: null
      })
      continue
    }

    lines.push({
      kind: 'meta',
      raw: line,
      display: line,
      marker: '',
      oldLineNumber: null,
      newLineNumber: null
    })
  }

  return {
    lines,
    summary: {
      additions,
      deletions,
      hunks,
      files
    }
  }
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function SummaryChip({ value, tone }: { value: string; tone?: 'neutral' | 'addition' | 'deletion' }) {
  const toneClass =
    tone === 'addition'
      ? 'text-emerald-300 border-emerald-400/20 bg-emerald-500/10'
      : tone === 'deletion'
        ? 'text-rose-300 border-rose-400/20 bg-rose-500/10'
        : 'text-[var(--mc-text-secondary)] border-[var(--mc-border)] bg-[var(--mc-bg-primary)]/50'

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>
      {value}
    </span>
  )
}

function getRowClass(line: ParsedDiffLine): string {
  switch (line.kind) {
    case 'addition':
      return 'bg-emerald-500/10 text-emerald-100'
    case 'deletion':
      return 'bg-rose-500/10 text-rose-100'
    case 'hunk':
      return 'bg-sky-500/10 text-sky-200'
    case 'meta':
      return 'bg-[var(--mc-bg-secondary)]/40 text-[var(--mc-text-muted)]'
    case 'note':
      return 'bg-amber-500/10 text-amber-200'
    default:
      return 'text-[var(--mc-text-secondary)]'
  }
}

export function DiffRenderer({ diff, emptyLabel = 'No diff available' }: DiffRendererProps) {
  if (!diff) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--mc-text-muted)]">
        {emptyLabel}
      </div>
    )
  }

  const parsed = parseUnifiedDiff(diff)
  const { summary } = parsed

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mc-bg-primary)]">
      <div className="border-b border-[var(--mc-border)] bg-[var(--mc-bg-secondary)]/35">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <SummaryChip value={pluralize(Math.max(summary.files, 1), 'file')} />
          <SummaryChip value={pluralize(summary.hunks, 'hunk')} />
          <SummaryChip value={`+${summary.additions}`} tone="addition" />
          <SummaryChip value={`-${summary.deletions}`} tone="deletion" />
          <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[var(--mc-text-muted)]">
            Unified diff
          </span>
        </div>

        <div className="grid grid-cols-[4.5rem_4.5rem_2rem_minmax(0,1fr)] border-t border-[var(--mc-border)]/60 px-4 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--mc-text-muted)]">
          <span className="pr-2 text-right">Old</span>
          <span className="pr-2 text-right">New</span>
          <span className="text-center"> </span>
          <span>Content</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-full w-max" style={{ fontFamily: 'var(--mc-terminal-font)' }}>
          {parsed.lines.map((line, index) => {
            const isFileBoundary = line.kind === 'meta' && line.raw.startsWith('diff --git ')
            const rowClass = getRowClass(line)

            return (
              <div
                key={`${index}-${line.raw}`}
                className={`grid grid-cols-[4.5rem_4.5rem_2rem_minmax(0,1fr)] border-b border-[var(--mc-border)]/20 text-[12px] leading-6 hover:bg-white/[0.03] ${rowClass} ${isFileBoundary && index > 0 ? 'mt-4 border-t border-t-[var(--mc-border)]/50' : ''}`}
              >
                <span className="select-none px-3 text-right tabular-nums text-[10px] text-[var(--mc-text-muted)]">
                  {line.oldLineNumber ?? ''}
                </span>
                <span className="select-none px-3 text-right tabular-nums text-[10px] text-[var(--mc-text-muted)]">
                  {line.newLineNumber ?? ''}
                </span>
                <span className="select-none px-1 text-center text-[10px] font-semibold text-[var(--mc-text-muted)]">
                  {line.marker}
                </span>
                <span className="whitespace-pre px-3">{line.display || ' '}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
