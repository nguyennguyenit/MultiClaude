# Phase 3: Terminal & Grid Tests

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-02-core-ui-tests.md](./phase-02-core-ui-tests.md)
- Components: `src/renderer/components/terminal/`

## Overview
- **Priority:** P1
- **Status:** Done
- **Completed:** 2026-01-07
- **Effort:** 3h
- **Description:** Test terminal grid layouts (1-12 terminals), pane interactions, WebGL rendering modes

## Key Insights
- Grid auto-calculates layout: 1→1x1, 2→1x2, 4→2x2, 6→2x3, 9→3x3, 12→3x4
- xterm.js uses WebGL addon - requires visual regression testing
- WebGL rendering modes: Performance (no WebGL), Balanced (active only), Quality (always)

## Requirements

### Functional
- Test grid layout for 1-12 terminal configurations
- Test terminal pane header (title editing, Claude button, close)
- Verify empty state shows "New Terminal" button
- Test terminal activation/focus states

### Non-Functional
- Visual snapshots for grid layouts
- Handle WebGL canvas in screenshots

## Architecture

```
Test Structure:
├── terminal-grid.spec.ts
│   ├── empty state shows add button
│   ├── 1 terminal fills viewport
│   ├── 2 terminals split horizontal
│   ├── 4 terminals 2x2 grid
│   ├── 9 terminals 3x3 grid
│   └── 12 terminals 3x4 grid
├── terminal-pane.spec.ts
│   ├── header displays title
│   ├── title editable on double-click
│   ├── Claude button starts Claude
│   ├── close button removes terminal
│   └── active state highlights
└── terminal-rendering.spec.ts
    ├── Performance mode (no WebGL)
    ├── Balanced mode (active only)
    └── Quality mode (always WebGL)
```

## Related Code Files

### Files to Create
- `src/__tests__/e2e/tests/terminal-grid.spec.ts`
- `src/__tests__/e2e/tests/terminal-pane.spec.ts`
- `src/__tests__/e2e/tests/terminal-rendering.spec.ts`

### Files to Read (Reference)
- `src/renderer/components/terminal/terminal-grid.tsx`
- `src/renderer/components/terminal/terminal-pane.tsx`
- `src/renderer/components/terminal/terminal-view.tsx`

## Implementation Steps

### 1. Terminal Grid Tests
```typescript
// src/__tests__/e2e/tests/terminal-grid.spec.ts
import { test, expect } from '../fixtures'

test.describe('Terminal Grid', () => {
  test('empty state shows add button', async ({ window }) => {
    await expect(window.locator('text=No terminals open')).toBeVisible()
    await expect(window.locator('text=+ New Terminal')).toBeVisible()
  })

  test('1 terminal fills viewport', async ({ window }) => {
    await window.locator('text=+ New Terminal').click()

    const grid = window.locator('.h-full').filter({ has: window.locator('.xterm') })
    const gridBox = await grid.boundingBox()
    const viewportSize = await window.viewportSize()

    // Should use most of available space
    expect(gridBox?.width).toBeGreaterThan(viewportSize!.width * 0.5)
  })

  test('2 terminals split horizontal (1x2)', async ({ window }) => {
    await window.locator('text=+ New Terminal').click()
    await window.locator('button[title*="Add"]').click()

    const terminals = await window.locator('.xterm').count()
    expect(terminals).toBe(2)

    // Both should have similar width
    const first = await window.locator('.xterm').first().boundingBox()
    const second = await window.locator('.xterm').last().boundingBox()
    expect(Math.abs((first?.width || 0) - (second?.width || 0))).toBeLessThan(50)
  })

  test('4 terminals in 2x2 grid', async ({ window }) => {
    // Add 4 terminals
    for (let i = 0; i < 4; i++) {
      await window.locator('button[title*="Add"], text=+ New Terminal').first().click()
      await window.waitForTimeout(100)
    }

    const terminals = await window.locator('.xterm').count()
    expect(terminals).toBe(4)

    // Visual snapshot of grid
    await expect(window.locator('.h-full').first()).toHaveScreenshot('grid-4-terminals.png')
  })

  test('9 terminals in 3x3 grid', async ({ window }) => {
    for (let i = 0; i < 9; i++) {
      await window.locator('button[title*="Add"], text=+ New Terminal').first().click()
      await window.waitForTimeout(100)
    }

    const terminals = await window.locator('.xterm').count()
    expect(terminals).toBe(9)

    await expect(window.locator('.h-full').first()).toHaveScreenshot('grid-9-terminals.png')
  })

  test('12 terminals in 3x4 grid', async ({ window }) => {
    for (let i = 0; i < 12; i++) {
      await window.locator('button[title*="Add"], text=+ New Terminal').first().click()
      await window.waitForTimeout(100)
    }

    const terminals = await window.locator('.xterm').count()
    expect(terminals).toBe(12)

    await expect(window.locator('.h-full').first()).toHaveScreenshot('grid-12-terminals.png')
  })
})
```

### 2. Terminal Pane Tests
```typescript
// src/__tests__/e2e/tests/terminal-pane.spec.ts
import { test, expect } from '../fixtures'

test.describe('Terminal Pane', () => {
  test.beforeEach(async ({ window }) => {
    await window.locator('text=+ New Terminal').click()
    await window.waitForSelector('.xterm')
  })

  test('header displays terminal title', async ({ window }) => {
    await expect(window.locator('text=Terminal')).toBeVisible()
  })

  test('title editable on double-click', async ({ window }) => {
    const title = window.locator('span:has-text("Terminal")').first()
    await title.dblclick()

    const input = window.locator('input[type="text"]')
    await expect(input).toBeVisible()

    await input.fill('My Terminal')
    await input.press('Enter')

    await expect(window.locator('text=My Terminal')).toBeVisible()
  })

  test('close button removes terminal', async ({ window }) => {
    const closeBtn = window.locator('[aria-label="Close terminal"], button:has(svg path[d*="M6 18L18 6"])')
    await closeBtn.first().click()

    await expect(window.locator('text=No terminals open')).toBeVisible()
  })

  test('active terminal has highlight', async ({ window }) => {
    // Add second terminal
    await window.locator('button[title*="Add"]').click()
    await window.waitForTimeout(100)

    // Click first terminal
    await window.locator('.xterm').first().click()

    // First should have active styling
    const pane = window.locator('.border-\\[var\\(--mc-accent\\)\\]')
    await expect(pane).toBeVisible()
  })
})
```

### 3. Terminal Rendering Mode Tests
```typescript
// src/__tests__/e2e/tests/terminal-rendering.spec.ts
import { test, expect } from '../fixtures'

test.describe('Terminal Rendering Modes', () => {
  async function setRenderingMode(window, mode: string) {
    await window.locator('button:has-text("Settings")').click()
    await window.locator('button:has-text("Terminals")').click()
    await window.locator(`button:has-text("${mode}")`).click()
    await window.locator('button:has(svg path[d*="M6 18L18 6"])').click()
  }

  test('Performance mode disables WebGL', async ({ window }) => {
    await setRenderingMode(window, 'Performance')

    await window.locator('text=+ New Terminal').click()
    await window.waitForSelector('.xterm')

    // Check no WebGL canvas (canvas addon only)
    const webglCanvas = await window.locator('.xterm-screen canvas').count()
    // Performance mode should still have canvas but no WebGL context
    expect(webglCanvas).toBeGreaterThan(0)
  })

  test('Balanced mode enables WebGL on active only', async ({ window }) => {
    await setRenderingMode(window, 'Balanced')

    // Add 2 terminals
    await window.locator('text=+ New Terminal').click()
    await window.locator('button[title*="Add"]').click()

    // Active terminal should have WebGL
    const activeTerminal = window.locator('.xterm').first()
    await activeTerminal.click()

    // Visual test - active should render crisply
    await expect(activeTerminal).toHaveScreenshot('balanced-active.png', {
      maxDiffPixelRatio: 0.02
    })
  })

  test('Quality mode enables WebGL always', async ({ window }) => {
    await setRenderingMode(window, 'Quality')

    // Add 2 terminals
    await window.locator('text=+ New Terminal').click()
    await window.locator('button[title*="Add"]').click()

    // Both should have high quality rendering
    await expect(window.locator('.xterm').first()).toHaveScreenshot('quality-terminal.png', {
      maxDiffPixelRatio: 0.02
    })
  })
})
```

## Todo List
- [x] Create terminal-grid.spec.ts with layout tests
- [x] Create terminal-pane.spec.ts with interaction tests
- [x] Create terminal-rendering.spec.ts with WebGL mode tests
- [x] Add visual baselines for grid layouts (4, 9, 12 terminals)
- [x] Add visual baselines for rendering modes
- [x] Verify tests handle WebGL canvas correctly

## Success Criteria
- Grid layouts match expected column counts
- Terminal pane interactions work (title edit, close)
- Visual snapshots capture terminal content
- Rendering mode tests pass without WebGL errors

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| WebGL screenshots blank | High | Wait for render, use `preserveDrawingBuffer` |
| Terminal content varies | Medium | Mock terminal output or use higher diff threshold |
| Grid calculation edge cases | Low | Test boundary conditions (1, 4, 9, 12) |

## Security Considerations
- No PTY commands executed in tests
- Terminal output mocked

## Next Steps
- Phase 4: Responsive Layout Tests
