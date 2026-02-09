# Responsive Layout & Visual Regression Testing Research

**Date:** 2026-01-06 | **Scope:** Electron 33 + React 19 + Vitest

---

## 1. Viewport/Responsive Testing in Electron

### Electron BrowserWindow Resize
```typescript
mainWindow.setSize(1920, 1080);
mainWindow.setContentSize(1366, 768); // Content area only

// DevTools Protocol for device emulation
await webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
  width: 1280, height: 720, deviceScaleFactor: 1, mobile: false
});
```

### Playwright Electron Integration
```typescript
import { _electron as electron } from '@playwright/test';
const app = await electron.launch({ args: ['./dist/main/index.js'] });
const page = await app.firstWindow();
await page.setViewportSize({ width: 1920, height: 1080 });
```

| Resolution | Use Case |
|------------|----------|
| 1920x1080 | Full HD desktop (primary) |
| 1366x768 | Laptop (common) |
| 1280x720 | HD minimum |

---

## 2. Visual Regression Tools Comparison

| Tool | Type | Cost | Electron Support | Best For |
|------|------|------|------------------|----------|
| **Playwright** | Built-in | Free | Native `_electron` API | E2E + screenshots |
| **BackstopJS** | Self-hosted | Free | Via Puppeteer/Playwright | On-premise |
| **Percy** | Cloud SaaS | Paid* | Via Playwright SDK | Enterprise CI/CD |
| **Chromatic** | Cloud SaaS | Paid* | Via Storybook | Component-driven |
| **jest-image-snapshot** | Library | Free | Via Puppeteer | Jest integration |

### Recommendation: Playwright Native

- Native Electron support via `_electron` API
- Built-in `toHaveScreenshot()` - zero extra deps
- Handles viewport resize natively; Vitest-compatible
- Free, no cloud dependency

---

## 3. Screenshot-Based Testing Strategy

### Theme Matrix (42 combinations per component)
```typescript
const viewports = [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }];
const themes = ['zinc','slate','blue','green','orange','rose','violet'];
const modes = ['light', 'dark'];
```

### Playwright Test Example
```typescript
test('terminal grid dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await expect(page).toHaveScreenshot('grid-dark.png', { maxDiffPixelRatio: 0.01 });
});
```

### Handling Dynamic Content
- **xterm.js:** Mock/freeze terminal content before capture
- **Animations:** Wait with `page.waitForLoadState('networkidle')`

---

## 4. React Component Testing

### Playwright Component Testing (No Storybook needed)
```typescript
import { test, expect } from '@playwright/experimental-ct-react';
test('TerminalTabs renders', async ({ mount }) => {
  const c = await mount(<TerminalTabs tabs={mockTabs} />);
  await expect(c).toHaveScreenshot();
});
```

---

## 5. Implementation Plan

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Add `@playwright/test`, configure Electron launch | 2h |
| 2 | Viewport + theme matrix E2E tests | 4h |
| 3 | Component tests (TerminalTabs, Sidebar, GitPanel) | 4h |

```json
{ "devDependencies": { "@playwright/test": "^1.48.0" },
  "scripts": { "test:visual": "playwright test --project=visual" } }
```

---

## Summary

| Approach | Effort | Coverage | Cost |
|----------|--------|----------|------|
| Playwright native | Low | High | Free |
| + BackstopJS | Medium | High | Free |
| + Chromatic | High | Very High | $$$ |

**Final:** Start with Playwright built-in screenshots. Native Electron support, free, no Storybook required.

---

## Unresolved Questions

1. Mock terminal content or freeze during visual tests?
2. Acceptable pixel diff threshold for xterm.js WebGL variations?
3. CI runner GPU availability for WebGL mode testing?
