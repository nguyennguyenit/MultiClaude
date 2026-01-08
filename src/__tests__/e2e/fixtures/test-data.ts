/**
 * Mock data for MultiClaude E2E tests.
 * Provides consistent test fixtures for projects and terminals.
 */

export interface MockProject {
  id: string
  name: string
  path: string
  createdAt: string
  updatedAt: string
}

export interface MockTerminal {
  id: string
  title: string
  cwd: string
  isClaudeMode: boolean
  projectId: string
  createdAt: string
}

/**
 * Single mock project for basic tests.
 */
export const mockProject: MockProject = {
  id: 'test-project-1',
  name: 'TestProject',
  path: '/tmp/test-project',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

/**
 * Multiple projects for overflow testing.
 */
export const mockProjects: MockProject[] = Array.from({ length: 10 }, (_, i) => ({
  id: `test-project-${i + 1}`,
  name: `Project${i + 1}`,
  path: `/tmp/test-project-${i + 1}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}))

/**
 * Single mock terminal for basic tests.
 */
export const mockTerminal: MockTerminal = {
  id: 'test-terminal-1',
  title: 'Terminal 1',
  cwd: '/tmp/test-project',
  isClaudeMode: false,
  projectId: 'test-project-1',
  createdAt: new Date().toISOString()
}

/**
 * Multiple terminals for grid layout testing.
 */
export const mockTerminals: MockTerminal[] = Array.from({ length: 4 }, (_, i) => ({
  id: `test-terminal-${i + 1}`,
  title: `Terminal ${i + 1}`,
  cwd: `/tmp/test-project`,
  isClaudeMode: i === 0, // First terminal in Claude mode
  projectId: 'test-project-1',
  createdAt: new Date().toISOString()
}))

/**
 * Theme combinations for visual regression testing.
 * Uses 3 representative themes × 2 modes = 6 combinations.
 * Themes: default (classic), ocean (cool), vibrant (warm)
 */
export const themeTestCases = [
  { theme: 'default', mode: 'light' },
  { theme: 'default', mode: 'dark' },
  { theme: 'ocean', mode: 'light' },
  { theme: 'ocean', mode: 'dark' },
  { theme: 'vibrant', mode: 'light' },
  { theme: 'vibrant', mode: 'dark' }
] as const

/**
 * Viewport sizes for responsive testing.
 * Named viewport configurations for parameterized tests.
 */
export const viewportSizes = [
  { width: 1920, height: 1080, name: 'fhd' },
  { width: 1366, height: 768, name: 'laptop' },
  { width: 1280, height: 720, name: 'hd' },
  { width: 1024, height: 768, name: 'tablet' },
  { width: 800, height: 600, name: 'small' }
] as const

/** Sidebar width boundaries (px) */
export const SIDEBAR_DIMENSIONS = {
  MIN_COLLAPSED: 40,
  MAX_EXPANDED: 280
} as const
