import type { GitBranchDiffFile } from '@shared/types'
import { getStatusColor, getStatusLabel, groupByDir } from '../git-panel/git-file-utils'

interface BranchDiffFileListProps {
  files: GitBranchDiffFile[]
  onFileClick: (file: GitBranchDiffFile) => void
}

export function BranchDiffFileList({ files, onFileClick }: BranchDiffFileListProps) {
  if (files.length === 0) {
    return (
      <div className="px-4 py-2 text-[10px] text-[var(--mc-text-muted)] opacity-50 italic">
        No differences from base branch
      </div>
    )
  }

  const groups = groupByDir(files)

  return (
    <div>
      {Array.from(groups.entries()).map(([dirLabel, dirFiles]) => (
        <div key={dirLabel}>
          {/* Directory sub-header */}
          <div className="flex items-center justify-between px-2.5 py-[3px] bg-[var(--mc-bg-secondary)]/30">
            <div className="flex items-center gap-1 min-w-0">
              <svg className="w-2.5 h-2.5 text-[var(--mc-text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="text-[10px] text-[var(--mc-text-muted)] truncate">{dirLabel}</span>
            </div>
            <span className="text-[10px] text-[var(--mc-text-muted)] flex-shrink-0 ml-1 opacity-60">{dirFiles.length}</span>
          </div>

          {/* Files */}
          {dirFiles.map(file => (
            <div
              key={file.path}
              className="group/file flex items-center gap-1.5 pl-3 pr-2 py-[3px] cursor-pointer hover:bg-[var(--mc-bg-hover)] transition-colors"
              onClick={() => onFileClick(file)}
            >
              <span className={`font-mono text-[9px] font-bold w-3 flex-shrink-0 text-center ${getStatusColor(file.status)}`}>
                {getStatusLabel(file.status)}
              </span>

              <span className="text-[11px] text-[var(--mc-text-primary)] truncate flex-1 leading-tight">
                {file.path.split(/[/\\]/).pop()}
              </span>

              <div className="flex items-center gap-0.5 text-[10px] font-mono flex-shrink-0 opacity-70 group-hover/file:opacity-100 transition-opacity">
                {file.additions > 0 && <span className="text-green-400">+{file.additions}</span>}
                {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
