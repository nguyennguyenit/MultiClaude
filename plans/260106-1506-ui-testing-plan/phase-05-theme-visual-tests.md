# Phase 5: Theme & Visual Regression Tests

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-04-responsive-layout-tests.md](./phase-04-responsive-layout-tests.md)
- Constants: `src/shared/constants/themes.ts`

## Overview
- **Priority:** P2
- **Status:** Done (2026-01-07)
- **Effort:** 2h
- **Description:** Test 7 color themes × 2 modes (light/dark) with visual regression

## Key Insights
- 7 color themes: zinc, slate, blue, green, orange, rose, violet
- 3 modes: light, dark, system
- Theme applied via CSS classes on `<html>` element
- Total: 7 themes × 2 modes = 14 visual states to test

## Requirements

### Functional
- Apply each theme and verify visual appearance
- Test light/dark mode toggle
- Test system mode follows OS preference
- Visual snapshots for key components in each theme

### Non-Functional
- Visual baselines stored in git
- maxDiffPixelRatio: 0.01 for strict comparison

## Architecture

```
Test Structure:
themes.spec.ts
├── describe('Color Themes')
│   ├── zinc theme applies correctly
│   ├── slate theme applies correctly
│   ├── blue theme applies correctly
│   ├── green theme applies correctly
│   ├── orange theme applies correctly
│   ├── rose theme applies correctly
│   └── violet theme applies correctly
├── describe('Theme Modes')
│   ├── light mode applies
│   ├── dark mode applies
│   └── system mode follows preference
└── describe('Visual Regression')
    ├── sidebar in all themes
    ├── settings in all themes
    └── terminal in all themes
```

## Related Code Files

### Files to Create
- `src/__tests__/e2e/tests/themes.spec.ts`
- `src/__tests__/e2e/tests/visual-regression.spec.ts`

### Files to Read (Reference)
- `src/shared/constants/themes.ts` - Theme definitions
- `src/renderer/App.tsx` - Theme application logic

## Implementation Steps

### 1. Theme Application Tests
```typescript
// src/__tests__/e2e/tests/themes.spec.ts
import { test, expect } from '../fixtures'

const colorThemes = ['zinc', 'slate', 'blue', 'green', 'orange', 'rose', 'violet']
const themeModes = ['light', 'dark']

test.describe('Color Themes', () => {
  for (const theme of colorThemes) {
    test(`${theme} theme applies correctly`, async ({ window }) => {
      // Open settings and select theme
      await window.locator('button:has-text("Settings")').click()

      // Find theme button (may need to adjust selector)
      await window.locator(`button[title*="${theme}"], [data-theme="${theme}"]`).click()

      // Verify class applied to html
      const html = window.locator('html')
      await expect(html).toHaveClass(new RegExp(`theme-${theme}`))

      // Verify CSS variables changed
      const accentColor = await window.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--mc-accent')
      })
      expect(accentColor).toBeTruthy()
    })
  }
})

test.describe('Theme Modes', () => {
  test('light mode applies', async ({ window }) => {
    await window.locator('button:has-text("Settings")').click()
    await window.locator('button:has-text("Light")').click()

    const html = window.locator('html')
    await expect(html).toHaveClass(/light/)
    await expect(html).not.toHaveClass(/dark/)
  })

  test('dark mode applies', async ({ window }) => {
    await window.locator('button:has-text("Settings")').click()
    await window.locator('button:has-text("Dark")').click()

    const html = window.locator('html')
    await expect(html).toHaveClass(/dark/)
    await expect(html).not.toHaveClass(/\blight\b/)
  })

  test('system mode follows preference', async ({ window }) => {
    await window.locator('button:has-text("Settings")').click()
    await window.locator('button:has-text("System")').click()

    // Emulate dark mode preference
    await window.emulateMedia({ colorScheme: 'dark' })
    await window.waitForTimeout(100)

    const html = window.locator('html')
    await expect(html).toHaveClass(/dark/)

    // Emulate light mode preference
    await window.emulateMedia({ colorScheme: 'light' })
    await window.waitForTimeout(100)

    await expect(html).toHaveClass(/light/)
  })
})
```

### 2. Visual Regression Matrix Tests
```typescript
// src/__tests__/e2e/tests/visual-regression.spec.ts
import { test, expect } from '../fixtures'

const colorThemes = ['zinc', 'slate', 'blue', 'green', 'orange', 'rose', 'violet']
const themeModes = ['light', 'dark']

// Helper to set theme
async function setTheme(window, theme: string, mode: string) {
  await window.evaluate(({ theme, mode }) => {
    window.localStorage.setItem('colorTheme', theme)
    window.localStorage.setItem('themeMode', mode)
  }, { theme, mode })
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
}

test.describe('Visual Regression - Sidebar', () => {
  for (const mode of themeModes) {
    for (const theme of colorThemes) {
      test(`sidebar ${theme} ${mode}`, async ({ window }) => {
        await setTheme(window, theme, mode)

        // Setup project to show sidebar
        await window.evaluate(() => {
          window.localStorage.setItem('projects', JSON.stringify([
            { id: 'p1', name: 'Project', path: '/tmp/p1' }
          ]))
        })
        await window.reload()

        const sidebar = window.locator('[class*="bg-[var(--mc-bg-secondary)]"]').first()
        await expect(sidebar).toHaveScreenshot(
          `sidebar-${theme}-${mode}.png`,
          { maxDiffPixelRatio: 0.01 }
        )
      })
    }
  }
})

test.describe('Visual Regression - Settings Modal', () => {
  // Test representative subset to reduce test count
  const representativeThemes = ['zinc', 'blue', 'rose']

  for (const mode of themeModes) {
    for (const theme of representativeThemes) {
      test(`settings ${theme} ${mode}`, async ({ window }) => {
        await setTheme(window, theme, mode)

        await window.locator('button:has-text("Settings")').click()
        await window.waitForTimeout(100)

        const modal = window.locator('[class*="bg-[var(--mc-bg-secondary)]"]')
          .filter({ hasText: 'Appearance' })

        await expect(modal).toHaveScreenshot(
          `settings-${theme}-${mode}.png`,
          { maxDiffPixelRatio: 0.01 }
        )
      })
    }
  }
})

test.describe('Visual Regression - Terminal', () => {
  const representativeThemes = ['zinc', 'blue', 'rose']

  for (const mode of themeModes) {
    for (const theme of representativeThemes) {
      test(`terminal ${theme} ${mode}`, async ({ window }) => {
        await setTheme(window, theme, mode)

        await window.evaluate(() => {
          window.localStorage.setItem('projects', JSON.stringify([
            { id: 'p1', name: 'Project', path: '/tmp/p1' }
          ]))
        })
        await window.reload()
        await window.locator('text=+ New Terminal').click()
        await window.waitForSelector('.xterm')

        // Wait for terminal to render
        await window.waitForTimeout(200)

        const terminal = window.locator('.xterm').first()
        await expect(terminal).toHaveScreenshot(
          `terminal-${theme}-${mode}.png`,
          { maxDiffPixelRatio: 0.02 } // Higher tolerance for terminal
        )
      })
    }
  }
})
```

### 3. Update Baseline Script
```typescript
// Add to package.json scripts
{
  "scripts": {
    "test:visual": "playwright test -c src/__tests__/e2e/playwright.config.ts --grep 'Visual Regression'",
    "test:visual:update": "playwright test -c src/__tests__/e2e/playwright.config.ts --grep 'Visual Regression' --update-snapshots"
  }
}
```

## Todo List
- [x] Create themes.spec.ts with theme application tests
- [x] Create visual-regression.spec.ts with screenshot tests
- [x] Generate baselines for sidebar (14 combinations)
- [x] Generate baselines for settings (6 combinations)
- [x] Generate baselines for terminal (6 combinations)
- [x] Add update baseline script
- [x] Document how to update baselines

## Success Criteria
- All 7 themes apply correct CSS classes
- Light/dark modes toggle correctly
- System mode follows OS preference
- Visual baselines exist for key components
- Screenshot comparison catches regressions

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Too many screenshot combinations | Medium | Use representative subset (3 themes × 2 modes) |
| Font rendering differences | Medium | Bundle fonts, use Docker CI |
| Anti-aliasing variations | Low | Set maxDiffPixelRatio: 0.01-0.02 |

## Security Considerations
- No security implications for theme testing

## Next Steps
- Phase 6: Interactive & Keyboard Tests
