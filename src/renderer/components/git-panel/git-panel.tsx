import { useState } from 'react'
import { useGitPanel } from '../../hooks/use-git-panel'
import { ChangesList } from './changes-list'
import { DiffViewer } from './diff-viewer'
import { CommitForm } from './commit-form'
import { BranchSelector } from './branch-selector'
import { HistoryTab } from './history-tab'
import { StashTab } from './stash-tab'
import { BranchesTab } from './branches-tab'

type TabId = 'changes' | 'history' | 'stash' | 'branches'

interface GitPanelContentProps {
  projectPath: string | undefined
}

/** Git panel content for use inside a SlidePanel container */
export function GitPanelContent({ projectPath }: GitPanelContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('changes')
  const [syncing, setSyncing] = useState(false)

  const {
    gitStatus,
    files,
    selectedFile,
    diff,
    isLoading,
    branches,
    currentBranch,
    logEntries,
    stashEntries,
    refresh,
    selectFile,
    stageFile,
    unstageFile,
    stageAll,
    discardFile,
    commit,
    pull,
    push,
    checkoutBranch,
    createBranch,
    deleteBranch,
    mergeBranch,
    stashSave,
    stashApply,
    stashPop,
    stashDrop
  } = useGitPanel({ projectPath, enabled: true })

  const stagedCount = files.filter(f => f.staged).length
  const hasRemote = gitStatus?.hasRemote

  const handleSync = async () => {
    setSyncing(true)
    try { await pull(); await push() } finally { setSyncing(false) }
  }

  const handlePull = async () => {
    setSyncing(true)
    try { await pull() } finally { setSyncing(false) }
  }

  const handlePush = async () => {
    setSyncing(true)
    try { await push() } finally { setSyncing(false) }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'changes', label: 'Changes' },
    { id: 'history', label: 'History' },
    { id: 'stash', label: 'Stash' },
    { id: 'branches', label: 'Branches' }
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Actions: Refresh + Sync/Pull/Push + Branch Selector */}
      <div className="px-3 py-2 border-b border-[var(--mc-border)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
              title="Refresh"
            >
              <svg className={`w-3 h-3${isLoading ? ' animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {hasRemote && (
              <>
                <button onClick={handleSync} disabled={syncing}
                  className="p-1 hover:bg-[var(--mc-bg-hover)] rounded disabled:opacity-50" title="Sync (Pull + Push)">
                  <svg className={`w-3.5 h-3.5${syncing ? ' animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button onClick={handlePull} disabled={syncing}
                  className="p-1 hover:bg-[var(--mc-bg-hover)] rounded disabled:opacity-50" title="Pull">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
                <button onClick={handlePush} disabled={syncing}
                  className="p-1 hover:bg-[var(--mc-bg-hover)] rounded disabled:opacity-50" title="Push">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <BranchSelector
            currentBranch={currentBranch}
            branches={branches}
            onCheckout={checkoutBranch}
            onCreate={createBranch}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--mc-border)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-1.5 text-xs ${
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
      {activeTab === 'changes' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChangesList
            files={files}
            selectedFile={selectedFile}
            onSelectFile={selectFile}
            onStageFile={stageFile}
            onUnstageFile={unstageFile}
            onDiscardFile={discardFile}
            onStageAll={stageAll}
          />
          <DiffViewer diff={diff} fileName={selectedFile} />
          <CommitForm stagedCount={stagedCount} onCommit={commit} />
        </div>
      )}

      {activeTab === 'history' && (
        <HistoryTab entries={logEntries} isLoading={isLoading} />
      )}

      {activeTab === 'stash' && (
        <StashTab
          entries={stashEntries}
          isLoading={isLoading}
          onSave={stashSave}
          onApply={stashApply}
          onPop={stashPop}
          onDrop={stashDrop}
        />
      )}

      {activeTab === 'branches' && (
        <BranchesTab
          branches={branches}
          currentBranch={currentBranch}
          isLoading={isLoading}
          onCheckout={checkoutBranch}
          onDelete={deleteBranch}
          onMerge={mergeBranch}
        />
      )}
    </div>
  )
}
