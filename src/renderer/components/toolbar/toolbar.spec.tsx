// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Project } from '@shared/types'

// Mock assets
vi.mock('../../assets/logo.png', () => ({ default: 'logo.png' }))

// Mock window-controls sub-component
vi.mock('./window-controls', () => ({
  WindowControls: () => null
}))

// Mock toolbar-button sub-component
vi.mock('./toolbar-button', () => ({
  ToolbarButton: ({ title }: { title: string }) => <button title={title} />
}))

const mockProject: Project = {
  id: 'proj-1',
  name: 'My Project',
  path: '/home/user/my-project',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const baseProps = {
  onAddTerminal: vi.fn(),
  terminalCount: 0,
  terminalLimit: 10,
  onToggleGitHub: vi.fn(),
  onToggleSettings: vi.fn(),
  activePanel: null,
  projects: [],
  activeProjectId: null,
  onSelectProject: vi.fn(),
  onAddProject: vi.fn(),
  onDeleteProject: vi.fn(),
  onReorderProjects: vi.fn()
}

// Deferred import after mocks are set up
let Toolbar: typeof import('./toolbar').Toolbar

beforeAll(async () => {
  const mod = await import('./toolbar')
  Toolbar = mod.Toolbar
})

describe('Toolbar', () => {
  beforeEach(() => {
    vi.stubGlobal('electron', {
      window: {
        getState: vi.fn(async () => ({ isMaximized: false, isFullScreen: false, isExpanded: false })),
        onStateChanged: vi.fn(() => vi.fn())
      }
    })
  })

  test('renders project tabs container', () => {
    const html = renderToStaticMarkup(<Toolbar {...baseProps} />)
    expect(html).toContain('data-testid="project-tabs-container"')
  })

  test('renders add project button', () => {
    const html = renderToStaticMarkup(<Toolbar {...baseProps} />)
    expect(html).toContain('data-testid="project-tabs-add"')
  })

  test('renders empty state when no projects', () => {
    const html = renderToStaticMarkup(<Toolbar {...baseProps} projects={[]} />)
    expect(html).toContain('data-testid="project-tabs-empty"')
  })

  test('renders project tabs when projects provided', () => {
    const html = renderToStaticMarkup(
      <Toolbar {...baseProps} projects={[mockProject]} activeProjectId="proj-1" />
    )
    expect(html).toContain(`data-testid="project-tab-${mockProject.id}"`)
    expect(html).not.toContain('data-testid="project-tabs-empty"')
  })

  test('active tab has active class', () => {
    const html = renderToStaticMarkup(
      <Toolbar {...baseProps} projects={[mockProject]} activeProjectId="proj-1" />
    )
    expect(html).toContain('toolbar-tab active')
  })

  test('inactive tab does not have active class when different project active', () => {
    const html = renderToStaticMarkup(
      <Toolbar {...baseProps} projects={[mockProject]} activeProjectId="other-id" />
    )
    expect(html).not.toContain('toolbar-tab active')
  })

  test('renders number badge for first 9 tabs', () => {
    const projects = Array.from({ length: 3 }, (_, i) => ({
      ...mockProject,
      id: `proj-${i + 1}`,
      name: `Project ${i + 1}`
    }))
    const html = renderToStaticMarkup(
      <Toolbar {...baseProps} projects={projects} />
    )
    // First 3 should have badges 1, 2, 3
    expect(html).toContain('toolbar-tab-badge')
  })

  test('tab delete button has correct aria-label', () => {
    const html = renderToStaticMarkup(
      <Toolbar {...baseProps} projects={[mockProject]} />
    )
    expect(html).toContain(`Remove project ${mockProject.name}`)
  })

  test('project tabs use pointer-driven reordering state', () => {
    const html = renderToStaticMarkup(
      <Toolbar {...baseProps} projects={[mockProject]} />
    )
    expect(html).toContain(`data-testid="project-tab-${mockProject.id}"`)
  })

  test('dropping a dragged project tab calls reorder callback', () => {
    const projects = [
      { ...mockProject, id: 'proj-1', name: 'Project 1' },
      { ...mockProject, id: 'proj-2', name: 'Project 2' },
      { ...mockProject, id: 'proj-3', name: 'Project 3' }
    ]
    const onReorderProjects = vi.fn()

    render(
      <Toolbar
        {...baseProps}
        projects={projects}
        onReorderProjects={onReorderProjects}
      />
    )

    const firstTab = screen.getByTestId('project-tab-proj-1')
    const thirdTab = screen.getByTestId('project-tab-proj-3')

    fireEvent.pointerDown(firstTab, { button: 0 })
    fireEvent.pointerEnter(thirdTab)
    fireEvent.pointerUp(thirdTab)

    expect(onReorderProjects).toHaveBeenCalledWith('proj-1', 2)
  })

  test('clears project drag state when pointer is released outside tabs', () => {
    const projects = [
      { ...mockProject, id: 'proj-1', name: 'Project 1' },
      { ...mockProject, id: 'proj-2', name: 'Project 2' }
    ]
    const onReorderProjects = vi.fn()

    render(
      <Toolbar
        {...baseProps}
        projects={projects}
        onReorderProjects={onReorderProjects}
      />
    )

    const firstTab = screen.getByTestId('project-tab-proj-1')
    const secondTab = screen.getByTestId('project-tab-proj-2')

    fireEvent.pointerDown(firstTab, { button: 0 })
    fireEvent.pointerUp(window)
    fireEvent.pointerEnter(secondTab)
    fireEvent.pointerUp(secondTab)

    expect(onReorderProjects).not.toHaveBeenCalled()
  })

  test('project tabs container is inside toolbar element', () => {
    const html = renderToStaticMarkup(<Toolbar {...baseProps} />)
    // Both toolbar and tabs container should be in same rendered output
    expect(html).toContain('class="toolbar"')
    expect(html).toContain('project-tabs-container')
  })
})
