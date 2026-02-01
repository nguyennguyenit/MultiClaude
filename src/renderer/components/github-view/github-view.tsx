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
import { IssuesTab } from './issues-tab'
import { PRsTab } from './prs-tab'

type TabId = 'changes' | 'history' | 'stash' | 'branches' | 'issues' | 'prs'

interface GitHubViewProps {
  projectPath: string | undefined
  isActive: boolean
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

export function GitHubView({ projectPath, isActive }: GitHubViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('changes')
  const [syncing, setSyncing] = useState(false)

  const gitPanel = useGitPanel({ projectPath, enabled: isActive })
  const repoName = parseRepoName(gitPanel.gitStatus?.remoteUrl)
  const changesCount = gitPanel.files.length
  const stagedCount = gitPanel.files.filter(f => f.staged).length

  const tabs = [
    {
      id: 'changes' as const,
      label: 'Changes',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    },
    {
      id: 'history' as const,
      label: 'History',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'branches' as const,
      label: 'Branches',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      )
    },
    {
      id: 'stash' as const,
      label: 'Stash',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    },
    {
      id: 'issues' as const,
      label: 'Issues',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'prs' as const,
      label: 'Pull Requests',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    }
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
      <div className="flex border-b border-[var(--mc-border)] bg-[var(--mc-bg-secondary)] px-4 gap-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              group relative py-3 text-sm font-medium flex items-center gap-2 transition-colors
              ${activeTab === tab.id
                ? 'text-[var(--mc-text-primary)]'
                : 'text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]'
              }
            `}
          >
            <span className={`${activeTab === tab.id ? 'text-[var(--mc-accent)]' : 'opacity-70 group-hover:opacity-100'}`}>
              {tab.icon}
            </span>
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--mc-accent)] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden bg-[var(--mc-bg-primary)]">
        {activeTab === 'changes' && (
          <div className="flex h-full">
            {/* File list */}
            <div className="w-72 border-r border-[var(--mc-border)] flex flex-col bg-[var(--mc-bg-secondary)]">
              <ChangesList
                files={gitPanel.files}
                selectedFile={gitPanel.selectedFile}
                onSelectFile={gitPanel.selectFile}
                onStageFile={gitPanel.stageFile}
                onUnstageFile={gitPanel.unstageFile}
                onDiscardFile={gitPanel.discardFile}
                onStageAll={gitPanel.stageAll}
              />
              <CommitForm
                stagedCount={stagedCount}
                onCommit={gitPanel.commit}
              />
            </div>
            {/* Diff viewer */}
            <div className="flex-1 flex flex-col min-w-0 bg-[var(--mc-bg-primary)]">
              <DiffViewer
                diff={gitPanel.diff}
                fileName={gitPanel.selectedFile}
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

        {activeTab === 'issues' && projectPath && (
          <IssuesTab projectPath={projectPath} />
        )}

        {activeTab === 'prs' && projectPath && (
          <PRsTab projectPath={projectPath} />
        )}
      </div>
    </div>
  )
}
