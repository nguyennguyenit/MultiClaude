---
title: "Paste Screenshot into Terminal"
description: "Ctrl+V to paste clipboard images into terminal - auto-saves to temp and inserts file path"
status: completed
priority: P2
effort: 4h
issue: null
branch: master
tags: [feature, frontend, backend, terminal, ux, ipc]
created: 2026-01-01
---

# Paste Screenshot into Terminal

## Overview

Enable pasting screenshots from clipboard into the terminal. When user presses Ctrl+V (Cmd+V on macOS) and clipboard contains an image, the image is saved to temp folder and the file path is inserted into terminal.

**Smart detection**: If clipboard has text, paste text normally. Only process image when clipboard contains image data.

## Related

- Previous feature: [File Drop](../260101-1653-file-drop-terminal/plan.md)
- Brainstorm: [brainstorm report](../reports/brainstorm-260101-1653-file-drop-terminal.md)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | IPC Handler for Clipboard Image | Done ✓ 2026-01-01 | 2h | [phase-01](./phase-01-ipc-clipboard-handler.md) |
| 2 | Terminal Paste Integration | Done ✓ 2026-01-01 | 2h | [phase-02-terminal-paste-integration.md](./phase-02-terminal-paste-integration.md) |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Renderer Process                                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  terminal-view.tsx                                         │  │
│  │  - Intercept Ctrl+V/Cmd+V                                  │  │
│  │  - Check clipboard for image data                          │  │
│  │  - If image: call IPC to save → get path → write to PTY   │  │
│  │  - If text: paste normally (existing behavior)            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │ IPC                                  │
└───────────────────────────┼──────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  Main Process                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  clipboard-handler.ts                                      │  │
│  │  - Read image from clipboard (nativeImage)                │  │
│  │  - Save to temp folder as PNG                             │  │
│  │  - Return file path                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Dependencies

- Electron `clipboard` module (built-in)
- Electron `nativeImage` (built-in)
- Node.js `fs` module (built-in)
- Node.js `os.tmpdir()` (built-in)

## Success Criteria

- [x] Ctrl+V/Cmd+V with image in clipboard saves to temp and inserts path
- [x] Ctrl+V/Cmd+V with text pastes text normally (no regression)
- [x] Screenshot files saved as PNG
- [x] Files saved to OS temp directory
- [x] Filename format: `screenshot-{timestamp}.png`
- [ ] Works on Linux, macOS, Windows (tested on Linux)

## Future Considerations

- Cleanup old screenshots (auto-delete after X days)
- Configurable save location
- Support for other image formats (JPEG)
