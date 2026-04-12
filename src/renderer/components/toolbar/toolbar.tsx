import { useEffect, useState, useRef, useCallback } from 'react'
import { ToolbarButton } from './toolbar-button'
import type { WindowState, Project } from '@shared/types'

// Detect macOS for traffic light padding
const isMac = navigator.platform.toLowerCase().includes('mac')
const DEFAULT_WINDOW_STATE: WindowState = {
  isMaximized: false,
  isFullScreen: false,
  isExpanded: false
}

interface ToolbarProps {
  onAddTerminal: () => void
  terminalCount: number
  terminalLimit: number
  onToggleGitHub: () => void
  onToggleSettings: () => void
  activePanel: string | null
  // Project tab props
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (id: string | null) => void
  onAddProject: () => void
  onDeleteProject: (id: string) => void
}

function IconGitHub() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

/** Single project tab inside the toolbar */
function ToolbarProjectTab({
  project,
  index,
  isActive,
  onSelect,
  onDelete,
  scrollContainerRef
}: {
  project: Project
  index: number
  isActive: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive && ref.current && scrollContainerRef.current) {
      requestAnimationFrame(() => {
        const el = ref.current
        const container = scrollContainerRef.current
        if (!el || !container) return
        // Scroll the tab container directly to center the active tab.
        // Avoids scrollIntoView({ inline: 'center' }) which can scroll ancestor
        // elements (including the document viewport), causing layout misalignment.
        const targetLeft = el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2
        container.scrollTo({
          left: Math.max(0, Math.min(targetLeft, container.scrollWidth - container.clientWidth)),
          behavior: 'smooth'
        })
      })
    }
  }, [isActive, scrollContainerRef])

  return (
    <div
      ref={ref}
      className={`toolbar-tab${isActive ? ' active' : ''}`}
      data-testid={`project-tab-${project.id}`}
    >
      {index < 9 && <span className="toolbar-tab-badge">{index + 1}</span>}
      <button
        type="button"
        className="toolbar-tab-btn"
        onClick={() => onSelect(project.id)}
        title={project.path}
      >
        {project.name}
      </button>
      <button
        type="button"
        className="toolbar-tab-delete"
        onClick={(e) => { e.stopPropagation(); onDelete(project.id) }}
        aria-label={`Remove project ${project.name}`}
      >
        ✕
      </button>
    </div>
  )
}

import { WindowControls } from './window-controls'

/** Compact 34px toolbar with inline Chrome-style project tabs */
export function Toolbar({
  onAddTerminal: _onAddTerminal,
  terminalCount: _terminalCount,
  terminalLimit: _terminalLimit,
  onToggleGitHub,
  onToggleSettings,
  activePanel,
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject
}: ToolbarProps) {
  const [windowState, setWindowState] = useState(DEFAULT_WINDOW_STATE)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkOverflow = useCallback(() => {
    const el = tabsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    checkOverflow()
    const el = tabsRef.current
    el?.addEventListener('scroll', checkOverflow)
    window.addEventListener('resize', checkOverflow)
    return () => {
      el?.removeEventListener('scroll', checkOverflow)
      window.removeEventListener('resize', checkOverflow)
    }
  }, [checkOverflow, projects])

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault()
      e.currentTarget.scrollLeft += e.deltaY * 0.5
    }
  }

  const scroll = (dir: 'left' | 'right') => {
    if (!tabsRef.current) return
    tabsRef.current.scrollLeft += dir === 'left' ? -120 : 120
  }

  useEffect(() => {
    if (!isMac) return
    let isSubscribed = true

    window.electron.window.getState()
      .then((state) => { if (isSubscribed) setWindowState(state) })
      .catch(() => {})

    const unsubscribe = window.electron.window.onStateChanged((state) => {
      if (isSubscribed) setWindowState(state)
    })

    return () => {
      isSubscribed = false
      unsubscribe()
    }
  }, [])

  return (
    <div className="toolbar">
      {/* Drag region sits behind interactive elements */}
      <div className="toolbar-drag" />

      {/* Left group: keep clear of traffic lights unless fullscreen */}
      <div
        className="toolbar-group toolbar-group-left"
        style={{ paddingLeft: isMac && !windowState.isFullScreen ? 80 : 8 }}
      />

      {/* Middle: scrollable project tabs */}
      <div className="toolbar-tabs-container" data-testid="project-tabs-container">
        {canScrollLeft && (
          <button type="button" className="toolbar-tabs-arrow" onClick={() => scroll('left')}>‹</button>
        )}
        <div ref={tabsRef} className="toolbar-tabs" onWheel={handleWheel}>
          {projects.length === 0 && (
            <span className="toolbar-tabs-empty" data-testid="project-tabs-empty">
              No projects — click + to add
            </span>
          )}
          {projects.map((p, i) => (
            <ToolbarProjectTab
              key={p.id}
              project={p}
              index={i}
              isActive={p.id === activeProjectId}
              onSelect={onSelectProject}
              onDelete={onDeleteProject}
              scrollContainerRef={tabsRef}
            />
          ))}
          <button
            type="button"
            className="toolbar-tabs-add"
            data-testid="project-tabs-add"
            onClick={onAddProject}
            title="Add Project"
            aria-label="Add Project"
          >
            +
          </button>
        </div>
        {canScrollRight && (
          <button type="button" className="toolbar-tabs-arrow" onClick={() => scroll('right')}>›</button>
        )}
      </div>

      {/* Right group: panel toggles + window controls */}
      <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
        <ToolbarButton
          icon={<IconGitHub />}
          title="GitHub Panel (Ctrl+G)"
          onClick={onToggleGitHub}
          active={activePanel === 'github'}
        />
        <ToolbarButton
          icon={<IconSettings />}
          title="Settings"
          onClick={onToggleSettings}
          active={activePanel === 'settings'}
          testId="settings-button"
        />
        {!isMac && <WindowControls />}
      </div>
    </div>
  )
}
