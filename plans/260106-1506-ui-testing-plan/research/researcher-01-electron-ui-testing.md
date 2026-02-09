# Electron UI Testing: Puppeteer vs Playwright

## Executive Summary

**Recommendation: Playwright** - Native Electron support, auto-waiting, built-in visual regression. Spectron deprecated Feb 2022.

---

## 1. Playwright + Electron (Recommended)

### Integration
```typescript
import { test, _electron as electron } from '@playwright/test';

test('app launches', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();

  // Renderer process interactions
  await window.click('#start-btn');
  await expect(window.locator('.terminal')).toBeVisible();

  // Main process access
  const path = await app.evaluate(({ app }) => app.getAppPath());

  await app.close();
});
```

### Key APIs
| Method | Context | Purpose |
|--------|---------|---------|
| `electron.launch()` | - | Start Electron app |
| `app.firstWindow()` | - | Get first BrowserWindow as Page |
| `app.evaluate()` | Main | Run code in main process |
| `window.locator()` | Renderer | DOM queries |

### Pros
- Native `_electron` API (no CDP config needed)
- Auto-waiting eliminates flaky tests
- Trace Viewer for debugging failures
- Built-in screenshot assertions
- Cross-platform consistency

### Cons
- Marked "experimental" (but stable in practice)
- Requires Electron v12.2.0+

---

## 2. Puppeteer + Electron

### Integration
```typescript
import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';

const electronProc = spawn('./node_modules/.bin/electron', [
  '--remote-debugging-port=9222', '.'
]);

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
const [page] = await browser.pages();
```

### Pros/Cons
- (+) Familiar API, more CDP control
- (-) Manual port setup, no main process access, no auto-waiting, requires `puppeteer-core`

---

## 3. xterm.js/WebGL Testing

### Problem
WebGL/Canvas bypasses DOM - element-based testing fails.

### Solution: Visual Regression
```typescript
test('terminal renders', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForSelector('.xterm-screen canvas');

  const terminal = window.locator('.xterm-screen');
  await expect(terminal).toHaveScreenshot('terminal-baseline.png', {
    maxDiffPixels: 100
  });
});
```

### Critical Issues
| Issue | Solution |
|-------|----------|
| Blank screenshots | Wait for render completion |
| DPI differences | Set `deviceScaleFactor: 1` |
| Font variations | Bundle fonts, use Docker CI |

---

## 4. Comparison Matrix

| Feature | Playwright | Puppeteer | WebdriverIO |
|---------|------------|-----------|-------------|
| Electron Support | Native | Manual CDP | Native Service |
| Auto-Wait | Yes | No | Yes |
| Main Process | Yes | No | Yes |
| Visual Regression | Built-in | Manual | Plugin |

---

## Unresolved Questions

1. Does current xterm.js config use WebGL or Canvas addon?
2. CI environment - GitHub Actions may need Xvfb for headless GPU
3. Acceptable screenshot diff threshold for anti-aliasing?
