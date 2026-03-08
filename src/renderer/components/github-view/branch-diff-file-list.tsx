import type { GitBranchDiffFile } from '@shared/types'
import { getStatusColor, getStatusLabel, groupByDir } from '../git-panel/git-file-utils'

interface BranchDiffFileListProps {
  files: GitBranchDiffFile[]
  onFileClick: (file: GitBranchDiffFile) => void
}

export function BranchDiffFileList({ files, onFileClick }: BranchDiffFileListProps) {
  if (files.length === 0) {
    return (
      <div className="px-4 py-1 text-[10px] italic text-[var(--mc-text-muted)] opacity-60">
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
          <div className="flex items-center justify-between px-3 py-[2px] bg-[var(--mc-bg-secondary)]/40">
            <span className="text-[10px] text-[var(--mc-text-muted)] truncate">{dirLabel}</span>
            <span className="text-[10px] text-[var(--mc-text-muted)] flex-shrink-0 ml-1">{dirFiles.length}</span>
          </div>

          {/* Files in this directory */}
          {dirFiles.map(file => (
            <div
              key={file.path}
              className="flex items-center gap-1.5 px-3 py-[3px] cursor-pointer hover:bg-[var(--mc-bg-hover)] transition-colors"
              onClick={() => onFileClick(file)}
            >
              <span className={`font-mono text-[10px] font-bold w-3 flex-shrink-0 ${getStatusColor(file.status)}`}>
                {getStatusLabel(file.status)}
              </span>

              <span className="text-[11px] text-[var(--mc-text-primary)] truncate flex-1 leading-tight">
                {file.path.split(/[/\\]/).pop()}
              </span>

              {/* Stats — always visible */}
              <div className="flex items-center gap-1 text-[10px] font-mono flex-shrink-0">
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
