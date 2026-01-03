import { useState, useRef, useEffect } from 'react'
import type { GitBranch } from '@shared/types'

interface BranchSelectorProps {
  currentBranch: string | undefined
  branches: GitBranch[]
  onCheckout: (name: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
  isLoading?: boolean
}

export function BranchSelector({
  currentBranch,
  branches,
  onCheckout,
  onCreate,
  isLoading
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [creating, setCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowCreate(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const localBranches = branches.filter(b => !b.isRemote)

  const handleCheckout = async (name: string) => {
    await onCheckout(name)
    setIsOpen(false)
  }

  const handleCreate = async () => {
    if (!newBranchName.trim()) return
    setCreating(true)
    await onCreate(newBranchName.trim())
    setNewBranchName('')
    setShowCreate(false)
    setCreating(false)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] rounded"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span className="text-green-400 max-w-[80px] truncate">{currentBranch || 'N/A'}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded shadow-lg z-50">
          {/* Branch list */}
          <div className="max-h-40 overflow-y-auto">
            {localBranches.map(branch => (
              <button
                key={branch.name}
                onClick={() => handleCheckout(branch.name)}
                disabled={branch.current}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-[var(--mc-bg-hover)] ${
                  branch.current ? 'text-green-400' : ''
                }`}
              >
                {branch.current && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={branch.current ? '' : 'ml-5'}>{branch.name}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--mc-border)]" />

          {/* Create branch */}
          {showCreate ? (
            <div className="p-2">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Branch name"
                className="w-full px-2 py-1 text-xs bg-[var(--mc-bg-hover)] rounded mb-1"
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-2 py-1 text-xs bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newBranchName.trim() || creating}
                  className="flex-1 px-2 py-1 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 disabled:opacity-50 rounded"
                >
                  {creating ? '...' : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-[var(--mc-bg-hover)]"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Branch
            </button>
          )}
        </div>
      )}
    </div>
  )
}
