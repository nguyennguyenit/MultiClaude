/**
 * Export all E2E test fixtures and utilities.
 */
export { test, expect, resetAppState, injectMockProject, takeConsistentScreenshot } from './electron-app'
export {
  mockProject,
  mockProjects,
  mockTerminal,
  mockTerminals,
  themeTestCases,
  viewportSizes,
  type MockProject,
  type MockTerminal
} from './test-data'
