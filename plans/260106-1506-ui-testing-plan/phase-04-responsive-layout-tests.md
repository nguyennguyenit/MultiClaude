# Phase 4: Responsive Layout Tests

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-03-terminal-grid-tests.md](./phase-03-terminal-grid-tests.md)
- Research: [researcher-02-responsive-visual-testing.md](./research/researcher-02-responsive-visual-testing.md)

## Overview
- **Priority:** P2
- **Status:** Done
- **Effort:** 3h
- **Completed:** 2026-01-07
- **Description:** Test UI at multiple viewport sizes (1920x1080, 1366x768, 1280x720)

## Key Insights
- Sidebar collapses at narrow widths (240px → 60px)
- Terminal grid adapts to available space
- Settings modal should remain usable at all sizes
- Use Playwright `setViewportSize()` for responsive testing

## Requirements

### Functional
- Test 3 target resolutions: 1920x1080, 1366x768, 1280x720
- Verify sidebar collapse behavior at each size
- Verify terminal grid fits without scrollbars
- Verify settings modal doesn't overflow

### Non-Functional
- Visual snapshots at each resolution
- Tests parameterized for easy extension

## Architecture

```
Test Structure:
responsive.spec.ts
├── describe('1920x1080 - Full HD')
│   ├── sidebar expanded
│   ├── terminal grid 3x3 fits
│   └── settings modal centered
├── describe('1366x768 - Laptop')
│   ├── sidebar fits
│   ├── terminal grid adapts
│   └── settings modal usable
└── describe('1280x720 - HD Minimum')
    ├── sidebar should auto-collapse
    ├── terminal grid compact
    └── modal may need scroll
```

## Related Code Files

### Files to Create
- `src/__tests__/e2e/tests/responsive.spec.ts`

### Files to Read (Reference)
- `src/renderer/App.tsx` - Main layout
- `src/renderer/components/sidebar/sidebar.tsx` - Width transitions
- `src/renderer/components/terminal/terminal-grid.tsx` - Grid sizing

## Implementation Steps

### 1. Parameterized Responsive Tests
```typescript
// src/__tests__/e2e/tests/responsive.spec.ts
import { test, expect } from '../fixtures'

const viewports = [
  { width: 1920, height: 1080, name: 'fhd' },
  { width: 1366, height: 768, name: 'laptop' },
  { width: 1280, height: 720, name: 'hd' }
]

for (const viewport of viewports) {
  test.describe(`Responsive ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.beforeEach(async ({ window }) => {
      await window.setViewportSize({ width: viewport.width, height: viewport.height })
    })

    test('full app layout fits viewport', async ({ window }) => {
      // Setup project to see full UI
      await window.evaluate(() => {
        window.localStorage.setItem('projects', JSON.stringify([
          { id: 'p1', name: 'Project', path: '/tmp/p1' }
        ]))
      })
      await window.reload()

      // Verify no horizontal scrollbar
      const hasHScroll = await window.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
      expect(hasHScroll).toBe(false)

      // Visual snapshot
      await expect(window.locator('body')).toHaveScreenshot(
        `layout-${viewport.name}.png`,
        { maxDiffPixelRatio: 0.01 }
      )
    })

    test('sidebar visible and functional', async ({ window }) => {
      await window.evaluate(() => {
        window.localStorage.setItem('projects', JSON.stringify([
          { id: 'p1', name: 'Project', path: '/tmp/p1' }
        ]))
      })
      await window.reload()

      const sidebar = window.locator('[class*="bg-[var(--mc-bg-secondary)]"]').first()
      await expect(sidebar).toBeVisible()

      const box = await sidebar.boundingBox()

      // At smaller sizes, sidebar might be collapsed
      if (viewport.width <= 1280) {
        // Should still be usable when collapsed
        expect(box?.width).toBeGreaterThan(50)
      } else {
        // Should be expanded at larger sizes
        expect(box?.width).toBeGreaterThan(200)
      }
    })

    test('terminal grid uses available space', async ({ window }) => {
      await window.evaluate(() => {
        window.localStorage.setItem('projects', JSON.stringify([
          { id: 'p1', name: 'Project', path: '/tmp/p1' }
        ]))
      })
      await window.reload()
      await window.locator('text=+ New Terminal').click()

      const terminal = window.locator('.xterm')
      const terminalBox = await terminal.first().boundingBox()

      // Terminal should use significant portion of viewport
      expect(terminalBox?.width).toBeGreaterThan(viewport.width * 0.4)
      expect(terminalBox?.height).toBeGreaterThan(viewport.height * 0.4)
    })

    test('settings modal fits viewport', async ({ window }) => {
      await window.locator('button:has-text("Settings")').click()

      const modal = window.locator('[class*="bg-[var(--mc-bg-secondary)]"]')
        .filter({ hasText: 'Appearance' })

      await expect(modal).toBeVisible()

      const modalBox = await modal.boundingBox()

      // Modal should fit within viewport
      expect(modalBox!.width).toBeLessThanOrEqual(viewport.width)
      expect(modalBox!.height).toBeLessThanOrEqual(viewport.height)

      await expect(modal).toHaveScreenshot(
        `settings-${viewport.name}.png`,
        { maxDiffPixelRatio: 0.01 }
      )
    })

    test('project tabs overflow handling', async ({ window }) => {
      // Add many projects
      const projects = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`, name: `Project${i}`, path: `/tmp/p${i}`
      }))
      await window.evaluate((p) => {
        window.localStorage.setItem('projects', JSON.stringify(p))
      }, projects)
      await window.reload()

      // At smaller widths, should show overflow
      const tabs = window.locator('[class*="project-tab"]')
      const visibleCount = await tabs.count()

      // Should have overflow dropdown or visible tabs
      const overflowBtn = window.locator('text=+')
      const hasOverflow = await overflowBtn.isVisible()

      if (viewport.width < 1400) {
        // Smaller screens likely need overflow
        expect(hasOverflow).toBe(true)
      }
    })
  })
}
```

### 2. Sidebar Collapse Behavior Tests
```typescript
// Additional tests for sidebar responsive behavior
test.describe('Sidebar Responsive Behavior', () => {
  test('auto-collapses at narrow width', async ({ window }) => {
    await window.setViewportSize({ width: 1000, height: 768 })

    await window.evaluate(() => {
      window.localStorage.setItem('projects', JSON.stringify([
        { id: 'p1', name: 'Project', path: '/tmp/p1' }
      ]))
    })
    await window.reload()

    const sidebar = window.locator('[class*="bg-[var(--mc-bg-secondary)]"]').first()
    const box = await sidebar.boundingBox()

    // Should be collapsed at narrow width
    expect(box?.width).toBeLessThan(100)
  })

  test('collapse toggle works at all sizes', async ({ window }) => {
    await window.setViewportSize({ width: 1920, height: 1080 })

    await window.evaluate(() => {
      window.localStorage.setItem('projects', JSON.stringify([
        { id: 'p1', name: 'Project', path: '/tmp/p1' }
      ]))
    })
    await window.reload()

    const collapseBtn = window.locator('button[title*="Collapse"]')
    await collapseBtn.click()

    const sidebar = window.locator('[class*="bg-[var(--mc-bg-secondary)]"]').first()
    const collapsedBox = await sidebar.boundingBox()
    expect(collapsedBox?.width).toBeLessThan(100)

    // Expand again
    const expandBtn = window.locator('button[title*="Expand"]')
    await expandBtn.click()

    const expandedBox = await sidebar.boundingBox()
    expect(expandedBox?.width).toBeGreaterThan(200)
  })
})
```

## Todo List
- [x] Create responsive.spec.ts with parameterized viewport tests
- [x] Test layout at 1920x1080
- [x] Test layout at 1366x768
- [x] Test layout at 1280x720
- [x] Add sidebar auto-collapse tests
- [x] Add visual baselines for each resolution
- [x] Test project tabs overflow at narrow widths

## Success Criteria
- No horizontal scrollbars at any resolution
- Sidebar usable (expanded or collapsed) at all sizes
- Terminal grid fills available space
- Settings modal fits viewport
- Visual baselines for each resolution

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Different DPI scaling | Medium | Set deviceScaleFactor: 1 in tests |
| Flaky resize tests | Low | Wait for layout to stabilize |

## Security Considerations
- No security implications for responsive testing

## Next Steps
- Phase 5: Theme & Visual Regression Tests
