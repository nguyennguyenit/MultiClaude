# Phase 1: Setup & Configuration

## Context Links
- Parent: [plan.md](./plan.md)
- Research: [researcher-01-electron-ui-testing.md](./research/researcher-01-electron-ui-testing.md)
- Docs: [code-standards.md](../docs/code-standards.md)

## Overview
- **Priority:** P1
- **Status:** Done
- **Effort:** 2h
- **Completed:** 2026-01-07
- **Description:** Install Playwright, configure for Electron testing, create test utilities

## Key Insights
- Playwright has native `_electron` API - no CDP config needed
- Requires built app (dist/) for Electron launch
- Use `deviceScaleFactor: 1` for consistent screenshots

## Requirements

### Functional
- Install Playwright test runner
- Configure Electron app launching
- Create reusable test fixtures
- Setup screenshot directory structure

### Non-Functional
- Tests must run without display (CI compatible)
- Screenshot baselines stored in git

## Architecture

```
src/
└── __tests__/
    └── e2e/
        ├── playwright.config.ts
        ├── fixtures/
        │   ├── electron-app.ts      # App launch fixture
        │   ├── test-data.ts         # Mock data
        │   └── index.ts
        ├── screenshots/             # Baseline images
        │   ├── terminal/
        │   ├── sidebar/
        │   └── settings/
        └── tests/
            ├── terminal.spec.ts
            ├── sidebar.spec.ts
            └── ...
```

## Related Code Files

### Files to Create
- `src/__tests__/e2e/playwright.config.ts` - Playwright configuration
- `src/__tests__/e2e/fixtures/electron-app.ts` - Electron launch fixture
- `src/__tests__/e2e/fixtures/test-data.ts` - Mock terminals, projects
- `src/__tests__/e2e/fixtures/index.ts` - Export fixtures

### Files to Modify
- `package.json` - Add Playwright dependency and scripts

## Implementation Steps

### 1. Install Dependencies
```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 2. Create Playwright Config
```typescript
// src/__tests__/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 30000,
  retries: 1,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts'
    }
  ]
})
```

### 3. Create Electron App Fixture
```typescript
// src/__tests__/e2e/fixtures/electron-app.ts
import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test'

type ElectronFixtures = {
  app: ElectronApplication
  window: Page
}

export const test = base.extend<ElectronFixtures>({
  app: async ({}, use) => {
    const app = await electron.launch({
      args: ['./dist/main/index.js'],
      env: { ...process.env, NODE_ENV: 'test' }
    })
    await use(app)
    await app.close()
  },
  window: async ({ app }, use) => {
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await use(window)
  }
})

export { expect } from '@playwright/test'
```

### 4. Create Mock Data
```typescript
// src/__tests__/e2e/fixtures/test-data.ts
export const mockProject = {
  id: 'test-project-1',
  name: 'TestProject',
  path: '/tmp/test-project',
  createdAt: new Date(),
  updatedAt: new Date()
}

export const mockTerminal = {
  id: 'test-terminal-1',
  title: 'Terminal 1',
  cwd: '/tmp/test-project',
  isClaudeMode: false,
  projectId: 'test-project-1',
  createdAt: new Date()
}
```

### 5. Add Package Scripts
```json
{
  "scripts": {
    "test:ui": "playwright test -c src/__tests__/e2e/playwright.config.ts",
    "test:ui:update": "playwright test -c src/__tests__/e2e/playwright.config.ts --update-snapshots",
    "test:ui:headed": "playwright test -c src/__tests__/e2e/playwright.config.ts --headed"
  }
}
```

## Todo List
- [x] Install @playwright/test dependency
- [x] Create playwright.config.ts
- [x] Create Electron app fixture
- [x] Create test data fixtures
- [x] Add npm scripts to package.json
- [x] Verify app launches in test mode
- [x] Create screenshots directory structure

## Success Criteria
- `npm run test:ui` runs without errors
- Electron app launches and closes cleanly in tests
- Fixtures are importable in test files

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Electron version incompatibility | High | Pin Playwright version compatible with Electron 33 |
| CI headless display issues | Medium | Use Xvfb or Docker with virtual display |

## Security Considerations
- Test environment uses `NODE_ENV=test`
- No production credentials in test fixtures

## Next Steps
- Phase 2: Core UI Component Tests
