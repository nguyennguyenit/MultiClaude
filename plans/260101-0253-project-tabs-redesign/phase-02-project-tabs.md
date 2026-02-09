# Phase 2: ProjectTabs Component

## Objective
Create horizontal project tabs bar below title bar with Alt+1~9 shortcuts.

## Files to Create

### 1. `src/renderer/components/project-tabs/project-tabs.tsx`

```typescript
import { useState, useRef, useEffect } from 'react'
import type { Project } from '@shared/types'

interface ProjectTabsProps {
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (id: string) => void
  onAddProject: () => void
}

const MAX_VISIBLE_TABS = 9

export function ProjectTabs({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject
}: ProjectTabsProps) {
  const [showOverflow, setShowOverflow] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  const visibleProjects = projects.slice(0, MAX_VISIBLE_TABS)
  const overflowProjects = projects.slice(MAX_VISIBLE_TABS)

  // Close overflow on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="h-9 bg-[var(--mc-bg-secondary)] border-b border-[var(--mc-border)] flex items-center px-2">
      {/* Visible Tabs */}
      <div className="flex-1 flex items-center gap-1 overflow-hidden">
        {visibleProjects.map((project, index) => (
          <button
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded text-sm
              transition-colors min-w-0 max-w-[160px]
              ${activeProjectId === project.id
                ? 'bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'
                : 'hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)]'
              }
            `}
            title={`${project.name} (Alt+${index + 1})`}
          >
            {/* Number badge */}
            <span className="text-xs text-[var(--mc-text-muted)] font-mono w-4">
              {index + 1}
            </span>
            {/* Project name */}
            <span className="truncate">{project.name}</span>
          </button>
        ))}

        {/* Add Project Button */}
        <button
          onClick={onAddProject}
          className="p-1.5 hover:bg-[var(--mc-bg-hover)] rounded flex-shrink-0"
          title="Add Project"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Overflow Dropdown */}
      {overflowProjects.length > 0 && (
        <div ref={overflowRef} className="relative flex-shrink-0">
          <button
            onClick={() => setShowOverflow(!showOverflow)}
            className="flex items-center gap-1 px-2 py-1.5 hover:bg-[var(--mc-bg-hover)] rounded text-sm"
          >
            <span className="text-[var(--mc-text-muted)]">+{overflowProjects.length}</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showOverflow && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded-lg shadow-lg py-1 min-w-[180px] z-50">
              {overflowProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    onSelectProject(project.id)
                    setShowOverflow(false)
                  }}
                  className={`
                    w-full text-left px-3 py-2 text-sm
                    ${activeProjectId === project.id
                      ? 'bg-[var(--mc-bg-active)]'
                      : 'hover:bg-[var(--mc-bg-hover)]'
                    }
                  `}
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### 2. `src/renderer/components/project-tabs/index.ts`

```typescript
export { ProjectTabs } from './project-tabs'
```

## Visual Reference

```
┌─────────────────────────────────────────────────────────────────┐
│ [1 Project1] [2 Project2] [3 Active] [+]              [+3 ▼] │
└─────────────────────────────────────────────────────────────────┘
     ↑              ↑           ↑       ↑                  ↑
   Badge         Hover      Active   Add Btn           Overflow
```

## Validation

After implementation:
1. Tabs render correctly
2. Click switches project
3. Add button works
4. Overflow dropdown shows correctly
5. Active project highlighted
