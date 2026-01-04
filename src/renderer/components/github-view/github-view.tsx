import { useState } from 'react'
import { useGitPanel } from '../../hooks/use-git-panel'
import { ChangesList } from '../git-panel/changes-list'
import { DiffViewer } from '../git-panel/diff-viewer'
import { CommitForm } from '../git-panel/commit-form'
import { HistoryTab } from '../git-panel/history-tab'
import { StashTab } from '../git-panel/stash-tab'
import { BranchesTab } from '../git-panel/branches-tab'
import { GitHubActionBar } from './github-action-bar'
import { RepoInfoHeader } from './repo-info-header'

type TabId = 'changes' | 'history' | 'stash' | 'branches'

interface GitHubViewProps {
  projectPath: string | undefined
}

// Parse remote URL to get owner/repo
function parseRepoName(remoteUrl: string | undefined): string | undefined {
  if (!remoteUrl) return undefined

  // Handle SSH format: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:(.+?)(?:\.git)?$/)
  if (sshMatch) return sshMatch[1]

  // Handle HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/github\.com\/(.+?)(?:\.git)?$/)
  if (httpsMatch) return httpsMatch[1]

  return undefined
}

export function GitHubView({ projectPath }: GitHubViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('changes')
  const [syncing, setSyncing] = useState(false)

  const gitPanel = useGitPanel({ projectPath, enabled: true })
  const repoName = parseRepoName(gitPanel.gitStatus?.remoteUrl)
  const changesCount = gitPanel.files.length
  const stagedCount = gitPanel.files.filter(f => f.staged).length

  const tabs = [
    { id: 'changes' as const, label: 'Changes' },
    { id: 'history' as const, label: 'History' },
    { id: 'stash' as const, label: 'Stash' },
    { id: 'branches' as const, label: 'Branches' }
  ]

  // Sync handlers
  const handlePush = async () => {
    setSyncing(true)
    try {
      await gitPanel.push()
    } finally {
      setSyncing(false)
    }
  }

  const handlePull = async () => {
    setSyncing(true)
    try {
      await gitPanel.pull()
    } finally {
      setSyncing(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await gitPanel.pull()
      await gitPanel.push()
    } finally {
      setSyncing(false)
    }
  }

  const handleFetch = async () => {
    setSyncing(true)
    try {
      await gitPanel.fetch()
    } finally {
      setSyncing(false)
    }
  }

  if (!projectPath) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--mc-text-muted)]">
        Select a project to view Git status
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Action Bar */}
      <GitHubActionBar
        repoName={repoName}
        hasRemote={gitPanel.gitStatus?.hasRemote ?? false}
        syncing={syncing}
        onPush={handlePush}
        onPull={handlePull}
        onSync={handleSync}
        onFetch={handleFetch}
      />

      {/* Repo Info Header */}
      <RepoInfoHeader
        repoName={repoName}
        currentBranch={gitPanel.currentBranch}
        changesCount={changesCount}
        branches={gitPanel.branches}
        onCheckoutBranch={gitPanel.checkoutBranch}
        onCreateBranch={gitPanel.createBranch}
        isLoading={gitPanel.isLoading}
      />

      {/* Tabs */}
      <div className="flex border-b border-[var(--mc-border)] bg-[var(--mc-bg-secondary)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm ${
              activeTab === tab.id
                ? 'border-b-2 border-[var(--mc-accent)] text-[var(--mc-accent)]'
                : 'text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'changes' && (
          <div className="flex h-full">
            {/* File list */}
            <div className="w-64 border-r border-[var(--mc-border)] flex flex-col">
              <ChangesList
                files={gitPanel.files}
                selectedFile={gitPanel.selectedFile}
                onSelectFile={gitPanel.selectFile}
                onStageFile={gitPanel.stageFile}
                onUnstageFile={gitPanel.unstageFile}
                onDiscardFile={gitPanel.discardFile}
                onStageAll={gitPanel.stageAll}
              />
            </div>
            {/* Diff viewer */}
            <div className="flex-1 flex flex-col min-w-0">
              <DiffViewer
                diff={gitPanel.diff}
                fileName={gitPanel.selectedFile}
              />
            </div>
            {/* Commit form */}
            <div className="w-72 border-l border-[var(--mc-border)] flex flex-col">
              <CommitForm
                stagedCount={stagedCount}
                onCommit={gitPanel.commit}
              />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryTab
            entries={gitPanel.logEntries}
            isLoading={gitPanel.isLoading}
          />
        )}

        {activeTab === 'stash' && (
          <StashTab
            entries={gitPanel.stashEntries}
            isLoading={gitPanel.isLoading}
            onSave={gitPanel.stashSave}
            onApply={gitPanel.stashApply}
            onPop={gitPanel.stashPop}
            onDrop={gitPanel.stashDrop}
          />
        )}

        {activeTab === 'branches' && (
          <BranchesTab
            branches={gitPanel.branches}
            currentBranch={gitPanel.currentBranch}
            isLoading={gitPanel.isLoading}
            onCheckout={gitPanel.checkoutBranch}
            onDelete={gitPanel.deleteBranch}
            onMerge={gitPanel.mergeBranch}
          />
        )}
      </div>
    </div>
  )
}
