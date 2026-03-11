# Phase 2: Core UI Component Tests

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-01-setup-configuration.md](./phase-01-setup-configuration.md)
- Components: `src/renderer/components/`

## Overview
- **Priority:** P1
- **Status:** Done
- **Effort:** 4h
- **Completed:** 2026-01-07
- **Description:** Create E2E tests for core UI components (Sidebar, Settings, Project Tabs)

## Key Insights
- Sidebar has collapsible state (240px/60px)
- Settings modal has 4 tabs (Appearance, Terminals, Notifications, Updates)
- Project tabs show Alt+1-9 shortcuts, overflow dropdown for 10+ projects

## Requirements

### Functional
- Test sidebar collapse/expand behavior
- Test settings modal tab navigation
- Test project tabs selection and overflow
- Verify empty states render correctly

### Non-Functional
- Tests complete in <30s each
- Visual snapshots for baseline comparison

## Architecture

```
Test Structure:
├── sidebar.spec.ts
│   ├── renders in expanded state
│   ├── collapses to 60px width
│   ├── shows tooltips when collapsed
│   ├── navigation items highlight on active
│   └── settings button shows update badge
├── settings.spec.ts
│   ├── modal opens/closes
│   ├── tab navigation works
│   ├── theme selector changes theme
│   └── terminal settings update
└── project-tabs.spec.ts
    ├── displays project tabs
    ├── keyboard shortcuts visible
    ├── overflow dropdown for 10+ projects
    └── delete button appears on hover
```

## Related Code Files

### Files to Create
- `src/__tests__/e2e/tests/sidebar.spec.ts`
- `src/__tests__/e2e/tests/settings.spec.ts`
- `src/__tests__/e2e/tests/project-tabs.spec.ts`

### Files to Read (Reference)
- `src/renderer/components/sidebar/sidebar.tsx`
- `src/renderer/components/settings/settings-modal.tsx`
- `src/renderer/components/project-tabs/project-tabs.tsx`

## Implementation Steps

### 1. Sidebar Tests
```typescript
// src/__tests__/e2e/tests/sidebar.spec.ts
import { test, expect } from '../fixtures'

test.describe('Sidebar', () => {
  test('renders in expanded state by default', async ({ window }) => {
    // Need a project to see sidebar
    await window.evaluate(() => {
      window.localStorage.setItem('projects', JSON.stringify([{
        id: 'test', name: 'Test', path: '/tmp/test'
      }]))
    })
    await window.reload()

    const sidebar = window.locator('[class*="bg-[var(--mc-bg-secondary)]"]').first()
    const box = await sidebar.boundingBox()
    expect(box?.width).toBeGreaterThan(200) // Expanded ~240px
  })

  test('collapses when toggle clicked', async ({ window }) => {
    const collapseBtn = window.locator('button[title*="Collapse"]')
    await collapseBtn.click()

    const sidebar = window.locator('[class*="bg-[var(--mc-bg-secondary)]"]').first()
    const box = await sidebar.boundingBox()
    expect(box?.width).toBeLessThan(100) // Collapsed ~60px
  })

  test('shows tooltips when collapsed', async ({ window }) => {
    const collapseBtn = window.locator('button[title*="Collapse"]')
    await collapseBtn.click()

    const navItem = window.locator('text=Terminals').first()
    await navItem.hover()

    // Tooltip should appear
    await expect(window.locator('.group-hover\\:opacity-100')).toBeVisible()
  })

  test('settings button shows update badge when available', async ({ window }) => {
    // Mock update available state
    await window.evaluate(() => {
      window.dispatchEvent(new CustomEvent('update-available'))
    })

    const badge = window.locator('.bg-\\[var\\(--mc-accent\\)\\].rounded-full')
    await expect(badge).toBeVisible()
  })
})
```

### 2. Settings Modal Tests
```typescript
// src/__tests__/e2e/tests/settings.spec.ts
import { test, expect } from '../fixtures'

test.describe('Settings Modal', () => {
  test.beforeEach(async ({ window }) => {
    // Open settings
    const settingsBtn = window.locator('button:has-text("Settings")')
    await settingsBtn.click()
  })

  test('modal opens and displays tabs', async ({ window }) => {
    await expect(window.locator('text=Appearance')).toBeVisible()
    await expect(window.locator('text=Terminals')).toBeVisible()
    await expect(window.locator('text=Notifications')).toBeVisible()
    await expect(window.locator('text=Updates')).toBeVisible()
  })

  test('tab navigation switches content', async ({ window }) => {
    // Click Notifications tab
    await window.locator('button:has-text("Notifications")').click()

    // Should show notification settings
    await expect(window.locator('text=Task Complete')).toBeVisible()
  })

  test('theme selector changes theme class', async ({ window }) => {
    const html = window.locator('html')

    // Click a theme button
    await window.locator('[class*="theme-"]').first().click()

    // Verify class changed
    await expect(html).toHaveClass(/theme-/)
  })

  test('modal closes on X button', async ({ window }) => {
    await window.locator('button:has(svg path[d*="M6 18L18 6"])').click()

    await expect(window.locator('text=Appearance')).not.toBeVisible()
  })
})
```

### 3. Project Tabs Tests
```typescript
// src/__tests__/e2e/tests/project-tabs.spec.ts
import { test, expect } from '../fixtures'

test.describe('Project Tabs', () => {
  test('displays empty state when no projects', async ({ window }) => {
    await expect(window.locator('text=No projects - click + to add')).toBeVisible()
  })

  test('shows keyboard shortcut badges', async ({ window }) => {
    // Setup project via localStorage
    await window.evaluate(() => {
      window.localStorage.setItem('projects', JSON.stringify([
        { id: 'p1', name: 'Project1', path: '/tmp/p1' },
        { id: 'p2', name: 'Project2', path: '/tmp/p2' }
      ]))
    })
    await window.reload()

    // Should show 1 and 2 badges
    await expect(window.locator('text=1')).toBeVisible()
    await expect(window.locator('text=2')).toBeVisible()
  })

  test('delete button appears on hover', async ({ window }) => {
    // Setup project
    await window.evaluate(() => {
      window.localStorage.setItem('projects', JSON.stringify([
        { id: 'p1', name: 'Project1', path: '/tmp/p1' }
      ]))
    })
    await window.reload()

    const tab = window.locator('text=Project1').first()
    await tab.hover()

    // Delete button should be visible
    const deleteBtn = window.locator('[aria-label="Remove project"]')
    await expect(deleteBtn).toBeVisible()
  })

  test('overflow dropdown for 10+ projects', async ({ window }) => {
    // Setup 10 projects
    const projects = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`, name: `Project${i}`, path: `/tmp/p${i}`
    }))
    await window.evaluate((p) => {
      window.localStorage.setItem('projects', JSON.stringify(p))
    }, projects)
    await window.reload()

    // Should show overflow indicator
    await expect(window.locator('text=+1')).toBeVisible()
  })
})
```

## Todo List
- [ ] Create sidebar.spec.ts with collapse/expand tests
- [ ] Create settings.spec.ts with tab navigation tests
- [ ] Create project-tabs.spec.ts with overflow tests
- [ ] Add visual snapshots for each component state
- [ ] Verify all tests pass locally

## Success Criteria
- All sidebar states tested (expanded, collapsed, with update badge)
- Settings modal tabs switch correctly
- Project tabs show shortcuts and overflow
- Tests complete in <2min total

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Flaky hover tests | Medium | Use explicit waits for hover states |
| localStorage mocking issues | Medium | Clear localStorage in beforeEach |

## Security Considerations
- No real project paths used in tests
- Mocked data only

## Next Steps
- Phase 3: Terminal & Grid Tests
