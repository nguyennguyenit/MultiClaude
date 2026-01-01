import { useState, useRef, useEffect } from 'react'
import type { Project } from '@shared/types'

interface ProjectTabsProps {
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (id: string) => void
  onAddProject: () => void
  onDeleteProject: (id: string) => void
}

// Max visible tabs with keyboard shortcuts
const MAX_VISIBLE_TABS = 9

export function ProjectTabs({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject
}: ProjectTabsProps) {
  const [showOverflow, setShowOverflow] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  // Close overflow dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOverflow(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const visibleProjects = projects.slice(0, MAX_VISIBLE_TABS)
  const overflowProjects = projects.slice(MAX_VISIBLE_TABS)

  return (
    <div className="flex items-center h-9 bg-[var(--mc-bg-secondary)] border-b border-[var(--mc-border)]">
      {/* Project Tabs */}
      <div className="flex-1 flex items-center overflow-x-auto">
        {visibleProjects.map((project, index) => (
          <div
            key={project.id}
            className={`
              group flex items-center gap-2 px-3 py-1.5 text-sm
              border-r border-[var(--mc-border)] min-w-[100px] max-w-[200px]
              transition-colors duration-150
              ${activeProjectId === project.id
                ? 'bg-[var(--mc-bg-primary)] text-[var(--mc-text-primary)] font-medium'
                : 'bg-[var(--mc-bg-tertiary)] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)]'
              }
            `}
          >
            <button
              onClick={() => onSelectProject(project.id)}
              className="flex items-center gap-2 flex-1 min-w-0"
              title={`${project.name} (Alt+${index + 1})`}
            >
              {/* Keyboard shortcut badge */}
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs rounded bg-[var(--mc-bg-tertiary)] text-[var(--mc-text-muted)]">
                {index + 1}
              </span>
              <span className="truncate">{project.name}</span>
            </button>
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteProject(project.id)
              }}
              className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-opacity"
              title="Remove project"
              aria-label="Remove project"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* Empty state when no projects */}
        {projects.length === 0 && (
          <div className="px-4 py-1.5 text-sm text-[var(--mc-text-muted)]">
            No projects - click + to add
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-2">
        {/* Overflow dropdown for 10+ projects */}
        {overflowProjects.length > 0 && (
          <div className="relative" ref={overflowRef}>
            <button
              onClick={() => setShowOverflow(!showOverflow)}
              className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-[var(--mc-bg-hover)] rounded"
              title={`${overflowProjects.length} more projects`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-xs text-[var(--mc-text-muted)]">+{overflowProjects.length}</span>
            </button>

            {showOverflow && (
              <div className="absolute right-0 top-full mt-1 min-w-[200px] bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded shadow-lg z-50">
                {overflowProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`
                      group flex items-center px-3 py-2 text-sm
                      hover:bg-[var(--mc-bg-hover)]
                      ${activeProjectId === project.id ? 'bg-[var(--mc-bg-primary)]' : ''}
                    `}
                  >
                    <button
                      onClick={() => {
                        onSelectProject(project.id)
                        setShowOverflow(false)
                      }}
                      className="flex-1 text-left"
                    >
                      {project.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteProject(project.id)
                        setShowOverflow(false)
                      }}
                      className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--mc-bg-tertiary)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)] transition-opacity"
                      title="Remove project"
                      aria-label="Remove project"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add project button */}
        <button
          type="button"
          onClick={onAddProject}
          className="p-1.5 hover:bg-[var(--mc-bg-hover)] rounded"
          title="Add Project"
          aria-label="Add Project"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
