---
title: "Comprehensive UI Testing Plan"
description: "Test all MultiClaude UI features including responsive layouts using Playwright + Electron"
status: completed
priority: P1
effort: 16h
branch: feature/terminal-rendering-mode
tags: [testing, ui, playwright, electron, visual-regression]
created: 2026-01-06
---

# Comprehensive UI Testing Plan

## Overview

Implement comprehensive UI testing for MultiClaude Electron app covering 35+ React components, responsive layouts, theme variations, and interactive features using Playwright with native Electron support.

## Research Summary

- **Tool Selection:** Playwright (native `_electron` API, built-in visual regression)
- **Why Not Puppeteer:** Manual CDP setup, no main process access, no auto-waiting
- **Visual Strategy:** Screenshot-based testing for xterm.js/WebGL content
- See: [research/researcher-01-electron-ui-testing.md](./research/researcher-01-electron-ui-testing.md), [research/researcher-02-responsive-visual-testing.md](./research/researcher-02-responsive-visual-testing.md)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Setup & Configuration | Done | 2h | [phase-01-setup-configuration.md](./phase-01-setup-configuration.md) |
| 2 | Core UI Component Tests | Done | 4h | [phase-02-core-ui-tests.md](./phase-02-core-ui-tests.md) |
| 3 | Terminal & Grid Tests | Done | 3h | [phase-03-terminal-grid-tests.md](./phase-03-terminal-grid-tests.md) |
| 4 | Responsive Layout Tests | Done | 3h | [phase-04-responsive-layout-tests.md](./phase-04-responsive-layout-tests.md) |
| 5 | Theme & Visual Regression Tests | Done | 2h | [phase-05-theme-visual-tests.md](./phase-05-theme-visual-tests.md) |
| 6 | Interactive & Keyboard Tests | Done | 2h | [phase-06-interactive-keyboard-tests.md](./phase-06-interactive-keyboard-tests.md) |

## Test Coverage Matrix

| Component Area | Components | Test Types |
|---------------|------------|------------|
| Terminal | terminal-grid, terminal-pane, terminal-view | Visual, Resize, State |
| Sidebar | sidebar, sidebar-header, navigation-item, user-account-card | Visual, Collapse, Hover |
| Project Tabs | project-tabs | Visual, Keyboard, Overflow |
| Settings | settings-modal, settings-panel, theme-selector, terminal-settings, notification-settings, update-settings | Visual, Tab, Form |
| Git Panel | git-panel, changes-list, commit-form, diff-viewer, branch-selector, branches-tab, history-tab, stash-tab | Visual, Interaction |
| GitHub View | github-view, github-action-bar, repo-info-header, issues-tab, prs-tab | Visual, Tab |
| Other | welcome-screen, toast-container | Visual, State |

## Dependencies

- `@playwright/test` ^1.48.0
- Playwright Electron API (`_electron`)
- Built production app for testing

## Test Execution

```bash
# Run all UI tests
npm run test:ui

# Update visual baselines
npm run test:ui:update

# Run responsive tests only
npm run test:ui -- --grep "responsive"
```

## Validation Summary

**Validated:** 2026-01-06
**Questions asked:** 4

### Confirmed Decisions
- **Terminal Content:** Clear & inject prompt before screenshots for consistency
- **Theme Coverage:** Representative 3 themes (zinc/blue/rose × light/dark = 6 combos)
- **CI Integration:** Full tests with Xvfb virtual display in GitHub Actions
- **Diff Threshold:** 2% for terminal anti-aliasing tolerance

### Action Items
- [x] Update phase-03 terminal tests to clear terminal before screenshots
- [x] Update phase-05 to use 3 representative themes instead of 7
- [x] Add Xvfb setup to CI workflow configuration
- [x] Set `maxDiffPixelRatio: 0.02` for all terminal-related screenshots

---

## Resolved Questions

1. ~~Terminal content mocking strategy?~~ → Clear terminal, inject fixed prompt
2. ~~Acceptable pixel diff threshold?~~ → 2% for terminals, 1% for static UI
3. ~~CI runner GPU requirements?~~ → Use Xvfb for virtual display
4. ~~Theme combinations count?~~ → 6 (3 themes × 2 modes)

---

## Completion Note

**Completed:** 2026-01-08 01:48 UTC

All 6 phases implemented. Action items resolved:
- Phase-03 terminal tests use shared `clearTerminal()` utility
- Phase-05 reduced to 3 representative themes (zinc/blue/rose)
- CI workflow configured with Xvfb virtual display
- Terminal screenshots use `maxDiffPixelRatio: 0.02`

Test suite ready for production use.
