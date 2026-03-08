import { useState, useCallback } from 'react'
import { useGitPanel } from '../../hooks/use-git-panel'
import { CollapsibleSection } from '../git-panel/collapsible-section'
import { DiffModal } from '../git-panel/diff-modal'
import { CommitForm } from '../git-panel/commit-form'
import { ChangesList } from '../git-panel/changes-list'
import { HistoryTab } from '../git-panel/history-tab'
import { StashTab } from '../git-panel/stash-tab'
import { IssuesTab } from './issues-tab'
import { PRsTab } from './prs-tab'
import { CompactHeader } from './compact-header'
import { BranchDiffFileList } from './branch-diff-file-list'
import type { GitFileStatus, GitBranchDiffFile } from '@shared/types'

interface DiffModalState {
  fileName: string
  fileStatus?: string
  additions?: number
  deletions?: number
  diff: string | null
  staged?: boolean
}

interface GitHubPanelContentProps {
  projectPath: string | undefined
}

export function GitHubPanelContent({ projectPath }: GitHubPanelContentProps) {
  const [syncing, setSyncing] = useState(false)
  const [diffModal, setDiffModal] = useState<DiffModalState | null>(null)
  const [showStashInput, setShowStashInput] = useState(false)

  const gitPanel = useGitPanel({ projectPath, enabled: true })

  const stagedFiles = gitPanel.files.filter(f => f.staged)
  const unstagedFiles = gitPanel.files.filter(f => !f.staged)

  // Open diff modal for a working-tree file
  const openFileDiff = useCallback(async (file: GitFileStatus) => {
    if (!projectPath) return
    const result = await window.electron.git.diff(projectPath, file.path, file.staged)
    setDiffModal({
      fileName: file.path,
      fileStatus: file.status,
      additions: file.additions,
      deletions: file.deletions,
      diff: result.success ? result.diff || null : null,
      staged: file.staged
    })
  }, [projectPath])

  // Open diff modal for a branch-diff file (diff against base branch, not working tree)
  const openBranchFileDiff = useCallback(async (file: GitBranchDiffFile) => {
    if (!projectPath) return
    const result = await window.electron.git.diffAgainstBranch(projectPath, file.path, gitPanel.baseBranch)
    setDiffModal({
      fileName: file.path,
      fileStatus: file.status,
      additions: file.additions,
      deletions: file.deletions,
      diff: result.success ? result.diff || null : null
    })
  }, [projectPath, gitPanel.baseBranch])

  const handlePush = async () => { setSyncing(true); try { await gitPanel.push() } finally { setSyncing(false) } }
  const handlePull = async () => { setSyncing(true); try { await gitPanel.pull() } finally { setSyncing(false) } }
  const handleFetch = async () => { setSyncing(true); try { await gitPanel.fetch() } finally { setSyncing(false) } }

  const handleCommitAndPush = async (message: string): Promise<boolean> => {
    const ok = await gitPanel.commit(message)
    if (ok) await gitPanel.push()
    return ok
  }

  if (!projectPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--mc-text-muted)] gap-4">
        <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
        </svg>
        <div className="text-lg font-medium">No Project Selected</div>
        <div className="text-sm opacity-60">Select a project from the sidebar to view Git status</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--mc-bg-primary)]">
      {/* Compact header: branch selector + fetch/pull/push */}
      <CompactHeader
        currentBranch={gitPanel.currentBranch}
        branches={gitPanel.branches}
        hasRemote={gitPanel.gitStatus?.hasRemote ?? false}
        syncing={syncing}
        isLoading={gitPanel.isLoading}
        onCheckoutBranch={gitPanel.checkoutBranch}
        onCreateBranch={gitPanel.createBranch}
        onFetch={handleFetch}
        onPull={handlePull}
        onPush={handlePush}
      />

      {/* Commit form */}
      <CommitForm
        stagedCount={stagedFiles.length}
        onCommit={gitPanel.commit}
        onCommitAndPush={handleCommitAndPush}
      />

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Against base branch */}
        <CollapsibleSection
          id="against"
          title={`Against ${gitPanel.baseBranch}`}
          count={gitPanel.branchDiff?.files.length}
          defaultOpen
        >
          <BranchDiffFileList
            files={gitPanel.branchDiff?.files ?? []}
            onFileClick={openBranchFileDiff}
          />
        </CollapsibleSection>

        {/* Staged */}
        <CollapsibleSection
          id="staged"
          title="Staged"
          count={stagedFiles.length}
          countColor="text-green-400"
          defaultOpen
          actionIcon={<MinusIcon />}
          onAction={() => Promise.all(stagedFiles.map(f => gitPanel.unstageFile(f.path)))}
        >
          <ChangesList
            files={stagedFiles}
            mode="staged"
            onFileClick={openFileDiff}
            onUnstageFile={gitPanel.unstageFile}
          />
        </CollapsibleSection>

        {/* Unstaged */}
        <CollapsibleSection
          id="unstaged"
          title="Unstaged"
          count={unstagedFiles.length}
          countColor="text-amber-400"
          defaultOpen
          actionIcon={<PlusIcon />}
          onAction={gitPanel.stageAll}
        >
          <ChangesList
            files={unstagedFiles}
            mode="unstaged"
            onFileClick={openFileDiff}
            onStageFile={gitPanel.stageFile}
            onDiscardFile={gitPanel.discardFile}
          />
        </CollapsibleSection>

        {/* Commits */}
        <CollapsibleSection
          id="commits"
          title="Commits"
          count={gitPanel.logEntries.length}
          defaultOpen={false}
        >
          <HistoryTab entries={gitPanel.logEntries} isLoading={gitPanel.isLoading} />
        </CollapsibleSection>

        {/* Stash */}
        <CollapsibleSection
          id="stash"
          title="Stash"
          count={gitPanel.stashEntries.length}
          defaultOpen={false}
          actionIcon={<StashIcon />}
          onAction={() => setShowStashInput(prev => !prev)}
        >
          <StashTab
            entries={gitPanel.stashEntries}
            isLoading={gitPanel.isLoading}
            showSaveInput={showStashInput}
            onSaveInputClose={() => setShowStashInput(false)}
            onSave={gitPanel.stashSave}
            onApply={gitPanel.stashApply}
            onPop={gitPanel.stashPop}
            onDrop={gitPanel.stashDrop}
          />
        </CollapsibleSection>

        {/* Issues */}
        <CollapsibleSection id="issues" title="Issues" defaultOpen={false}>
          <IssuesTab projectPath={projectPath} />
        </CollapsibleSection>

        {/* Pull Requests */}
        <CollapsibleSection id="prs" title="Pull Requests" defaultOpen={false}>
          <PRsTab projectPath={projectPath} />
        </CollapsibleSection>
      </div>

      {/* Diff modal overlay */}
      <DiffModal
        isOpen={!!diffModal}
        onClose={() => setDiffModal(null)}
        fileName={diffModal?.fileName ?? null}
        fileStatus={diffModal?.fileStatus}
        additions={diffModal?.additions}
        deletions={diffModal?.deletions}
        diff={diffModal?.diff ?? null}
        staged={diffModal?.staged}
      />
    </div>
  )
}

function PlusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  )
}

function StashIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  )
}
