import type { Project } from '@shared/types'

interface ProjectBarProps {
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (id: string | null) => void
  onAddProject: () => void
  onDeleteProject: (id: string) => void
  onToggleSettings: () => void
  settingsActive: boolean
}

const MAX_SHORTCUT_PROJECTS = 9

/** Horizontal project tab bar displayed at the bottom of the app */
export function ProjectBar({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onToggleSettings,
  settingsActive
}: ProjectBarProps) {
  return (
    <div className="project-bar">
      <div className="project-bar-tabs" data-testid="project-tabs-container">
        {projects.length === 0 && (
          <span className="project-bar-empty" data-testid="project-tabs-empty">
            No projects - click + to add
          </span>
        )}
        {projects.map((project, index) => (
          <div
            key={project.id}
            className={`project-bar-tab${activeProjectId === project.id ? ' active' : ''}`}
            data-testid={`project-tab-${project.id}`}
          >
            {index < MAX_SHORTCUT_PROJECTS && (
              <span className="project-bar-badge">{index + 1}</span>
            )}
            <button
              type="button"
              className="project-bar-tab-btn"
              onClick={() => onSelectProject(project.id)}
              title={project.path}
              aria-selected={activeProjectId === project.id}
            >
              {project.name}
            </button>
            <button
              type="button"
              className="project-bar-delete"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteProject(project.id)
              }}
              title={`Remove project ${project.name}`}
              aria-label={`Remove project ${project.name}`}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Add project button: positioned adjacent to last tab (Chrome-style) */}
        <button
          type="button"
          className="project-bar-add-inline"
          data-testid="project-tabs-add"
          onClick={onAddProject}
          title="Add Project"
          aria-label="Add Project"
        >
          +
        </button>
      </div>

      {/* Settings button at bottom-right */}
      <button
        type="button"
        className={`project-bar-settings${settingsActive ? ' active' : ''}`}
        data-testid="settings-button"
        onClick={onToggleSettings}
        title="Settings"
        aria-pressed={settingsActive}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
