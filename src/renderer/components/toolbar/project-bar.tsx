import type { Project } from '@shared/types'

interface ProjectBarProps {
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (id: string | null) => void
  onAddProject: () => void
  onDeleteProject: (id: string) => void
}

const MAX_SHORTCUT_PROJECTS = 9

/** Horizontal project tab bar displayed at the bottom of the app */
export function ProjectBar({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject
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
    </div>
  )
}
