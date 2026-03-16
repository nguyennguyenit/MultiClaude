import { useState, useCallback, useRef } from 'react'
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
import { GitHubAccountSection } from './github-account-section'
import { BranchDiffFileList } from './branch-diff-file-list'
import type { GitFileStatus, GitBranchDiffFile } from '@shared/types'

interface DiffModalState {
  fileName: string
  oldFileName?: string
  fileStatus?: string
  additions?: number
  deletions?: number
  diff: string
  isLoading: boolean
  error?: string
  sourceLabel?: string
  staged?: boolean
}

interface GitHubPanelContentProps {
  projectPath: string | undefined
}

export function GitHubPanelContent({ projectPath }: GitHubPanelContentProps) {
  const [syncing, setSyncing] = useState(false)
  const [diffModal, setDiffModal] = useState<DiffModalState | null>(null)
  const [showStashInput, setShowStashInput] = useState(false)
  const diffRequestIdRef = useRef(0)

  const gitPanel = useGitPanel({ projectPath, enabled: true })

  const stagedFiles = gitPanel.files.filter(f => f.staged)
  const unstagedFiles = gitPanel.files.filter(f => !f.staged)

  const closeDiffModal = useCallback(() => {
    diffRequestIdRef.current += 1
    setDiffModal(null)
  }, [])

  // Open diff modal for a working-tree file
  const openFileDiff = useCallback(async (file: GitFileStatus) => {
    if (!projectPath) return
    const requestId = ++diffRequestIdRef.current
    const modalBase: DiffModalState = {
      fileName: file.path,
      oldFileName: file.oldPath,
      fileStatus: file.status,
      additions: file.additions,
      deletions: file.deletions,
      diff: '',
      isLoading: true,
      sourceLabel: file.staged ? 'Staged changes' : 'Working tree',
      staged: file.staged
    }
    setDiffModal(modalBase)

    const result = await window.electron.git.diff(projectPath, file.path, file.staged, file.oldPath)
    if (diffRequestIdRef.current !== requestId) return

    setDiffModal({
      ...modalBase,
      diff: result.success ? result.diff || '' : '',
      isLoading: false,
      error: result.success ? undefined : (result.error || 'Failed to load diff')
    })
  }, [projectPath])

  // Open diff modal for a branch-diff file (diff against base branch, not working tree)
  const openBranchFileDiff = useCallback(async (file: GitBranchDiffFile) => {
    if (!projectPath) return
    const requestId = ++diffRequestIdRef.current
    const modalBase: DiffModalState = {
      fileName: file.path,
      oldFileName: file.oldPath,
      fileStatus: file.status,
      additions: file.additions,
      deletions: file.deletions,
      diff: '',
      isLoading: true,
      sourceLabel: `Against ${gitPanel.baseBranch}`
    }
    setDiffModal(modalBase)

    const result = await window.electron.git.diffAgainstBranch(projectPath, file.path, gitPanel.baseBranch, file.oldPath)
    if (diffRequestIdRef.current !== requestId) return

    setDiffModal({
      ...modalBase,
      diff: result.success ? result.diff || '' : '',
      isLoading: false,
      error: result.success ? undefined : (result.error || 'Failed to load diff')
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

      {/* Quick actions toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--mc-border)]/60 bg-[var(--mc-bg-secondary)]/20">
        <ToolbarButton onClick={gitPanel.stageAll} title="Stage All"><PlusAllIcon /></ToolbarButton>
        <ToolbarButton onClick={() => Promise.all(stagedFiles.map(f => gitPanel.unstageFile(f.path)))} title="Unstage All"><MinusAllIcon /></ToolbarButton>
        <ToolbarButton onClick={handleFetch} title="Refresh"><RefreshIcon /></ToolbarButton>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Staged */}
        <CollapsibleSection
          id="staged"
          title="Staged Changes"
          count={stagedFiles.length}
          countColor="text-green-400"
          defaultOpen
          actionIcon={<MinusIcon />}
          actionTitle="Unstage All"
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
          title="Changes"
          count={unstagedFiles.length}
          countColor="text-amber-400"
          defaultOpen
          actionIcon={<PlusIcon />}
          actionTitle="Stage All"
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

        {/* Against base branch */}
        <CollapsibleSection
          id="against"
          title={`Against ${gitPanel.baseBranch}`}
          count={gitPanel.branchDiff?.files.length}
          defaultOpen={false}
        >
          <BranchDiffFileList
            files={gitPanel.branchDiff?.files ?? []}
            onFileClick={openBranchFileDiff}
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

        {/* Issues */}
        <CollapsibleSection id="issues" title="Issues" defaultOpen={false}>
          <IssuesTab projectPath={projectPath} />
        </CollapsibleSection>

        {/* Pull Requests */}
        <CollapsibleSection id="prs" title="Pull Requests" defaultOpen={false}>
          <PRsTab projectPath={projectPath} />
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
      </div>

      {/* GitHub Account: auth status, git identity, login/logout */}
      <GitHubAccountSection
        currentBranch={gitPanel.currentBranch}
        hasRemote={gitPanel.gitStatus?.hasRemote ?? false}
      />

      {/* Diff modal overlay */}
      <DiffModal
        isOpen={!!diffModal}
        onClose={closeDiffModal}
        fileName={diffModal?.fileName ?? null}
        oldFileName={diffModal?.oldFileName}
        fileStatus={diffModal?.fileStatus}
        additions={diffModal?.additions}
        deletions={diffModal?.deletions}
        diff={diffModal?.diff ?? null}
        isLoading={diffModal?.isLoading ?? false}
        error={diffModal?.error}
        sourceLabel={diffModal?.sourceLabel}
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

function PlusAllIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function MinusAllIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'transparent',
        color: 'var(--mc-text-secondary, #8b949e)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        padding: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--mc-accent, #58a6ff)'
        e.currentTarget.style.background = 'var(--mc-bg-hover, rgba(255,255,255,0.05))'
        e.currentTarget.style.borderColor = 'rgba(88, 166, 255, 0.4)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--mc-text-secondary, #8b949e)'
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
      }}
    >
      {children}
    </button>
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
