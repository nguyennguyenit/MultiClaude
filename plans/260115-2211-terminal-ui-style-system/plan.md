---
title: "Terminal UI Style System"
description: "Add Settings → Appearance option for Terminal/TUI style with color presets, font selection, and border styles"
status: pending
priority: P2
effort: 10h
branch: beta
tags: [frontend, settings, theming, ui]
created: 2026-01-15
---

# Terminal UI Style System

## Overview

Add a new UI style option "Terminal" that transforms the entire app into a retro terminal/TUI aesthetic. Users can customize color presets (Green/Blue/White), monospace fonts, and border styles (1px solid vs ASCII box-drawing).

## Context

- Brainstorm: [brainstorm-260115-2211-terminal-ui-style-system.md](../reports/brainstorm-260115-2211-terminal-ui-style-system.md)
- Scout: [scout-260115-2215-theming-analysis.md](../reports/scout-260115-2215-theming-analysis.md)
- Research: [research/](./research/)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Types & Constants | Complete | 1h | [phase-01](./phase-01-types-and-constants.md) |
| 2 | CSS Variables & Styles | Complete ✅ | 3h | [phase-02](./phase-02-css-styles.md) |
| 3 | Settings Store | Complete ✅ 2026-01-18 | 1h | [phase-03](./phase-03-settings-store.md) |
| 4 | UI Components | Complete ✅ 2026-01-18 | 3h | [phase-04](./phase-04-ui-components.md) |
| 5 | App Integration | Complete ✅ 2026-01-18 | 1h | [phase-05](./phase-05-app-integration.md) |
| 6 | Testing | Complete ✅ 2026-01-18 | 1h | [phase-06](./phase-06-testing.md) |

## Requirements Summary

| Feature | Detail |
|---------|--------|
| UI Style toggle | Modern (default) vs Terminal |
| Color presets | Green (Matrix), Blue (Cyan), White |
| Font selection | JetBrains Mono, Source Code Pro, VT323, etc. |
| Border styles | 1px solid vs ASCII box-drawing chars |
| Scope | All components including modals/dialogs |

## Dependencies

- @fontsource/jetbrains-mono (self-hosted fonts)
- @fontsource/source-code-pro
- @fontsource/fira-code
- Google Fonts VT323 (or self-host)

## Validation Summary

**Validated:** 2026-01-15
**Questions asked:** 4

### Confirmed Decisions
- **Dark Mode only:** Terminal mode chỉ hoạt động với Dark Mode - không cần Light Mode variant
- **Color Theme UX:** Khi chọn Terminal, Color Theme section vẫn hiện nhưng **disabled** (không ẩn)
- **Live preview:** Thay đổi trong Settings preview ngay lập tức, Cancel sẽ revert
- **ASCII border scope:** Áp dụng cho Panels + Modals chính (sidebar, main panels, settings modal)

### Action Items
- [x] Update phase-04: Change Color Theme from hidden to disabled when terminal mode

## Success Criteria

1. Toggle between Modern and Terminal UI styles
2. 3 color presets work correctly
3. Font dropdown changes app font in Terminal mode
4. Border toggle works (1px vs ASCII)
5. Settings persist after restart
6. No regression on Modern mode
7. Color Theme section disabled (not hidden) in Terminal mode
