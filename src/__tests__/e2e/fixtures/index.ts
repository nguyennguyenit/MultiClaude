/**
 * Export all E2E test fixtures and utilities.
 */
export {
  test,
  expect,
  resetAppState,
  injectMockProject,
  takeConsistentScreenshot,
  addTerminal,
  clearTerminalForScreenshot,
  clearAllTerminalsForScreenshot,
  TERMINAL_TEST_PROMPT,
  WAIT_TIMES
} from './electron-app'
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
