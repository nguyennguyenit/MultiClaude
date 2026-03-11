---
title: "Production Build & Distribution Setup"
description: "Setup GitHub Actions CI/CD for multi-platform builds with auto-update"
status: done
priority: P1
effort: 3h
issue: null
branch: master
tags: [ci-cd, electron-builder, auto-update, github-actions]
created: 2026-01-03
---

# Production Build & Distribution Setup

## Overview

Enable public release of MultiClaude across all platforms (Linux, Windows, macOS) with automated CI/CD builds and in-app auto-update functionality.

**Context:** [Brainstorm Report](../reports/brainstorm-260103-0310-production-build-setup.md)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Install & Configure electron-updater | done | 30m | [phase-01](./phase-01-electron-updater-setup.md) |
| 2 | Implement Auto-Update in Main Process | done | 1h | [phase-02](./phase-02-auto-update-integration.md) |
| 3 | Create GitHub Actions Workflow | done | 1h | [phase-03](./phase-03-github-actions.md) |
| 4 | Test & Verify Release Process | done | 30m | [phase-04](./phase-04-test-release.md) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
├─────────────────────────────────────────────────────────────┤
│  Push tag v*  ──▶  GitHub Actions Workflow                  │
│                    ├── ubuntu-latest  ──▶ .AppImage, .deb   │
│                    ├── windows-latest ──▶ .exe (NSIS)       │
│                    └── macos-latest   ──▶ .dmg, .zip        │
│                           │                                  │
│                           ▼                                  │
│                    GitHub Releases                          │
│                    ├── latest.yml (Linux)                   │
│                    ├── latest-mac.yml                       │
│                    └── latest.yml (Windows)                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   MultiClaude App                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AutoUpdater (main process)                            │   │
│  │  ├── checkForUpdates() on app ready                   │   │
│  │  ├── download-progress ──▶ renderer (optional)        │   │
│  │  └── update-downloaded ──▶ notify user ──▶ quitAndInstall │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies

- GitHub repository with releases enabled
- `GH_TOKEN` secret in GitHub repo for publishing
- Node.js 18+ in GitHub Actions runners

## Success Criteria

- [ ] `npm install electron-updater` completes without errors
- [ ] Auto-update module integrated in `src/main/index.ts`
- [ ] `.github/workflows/release.yml` created and valid
- [ ] Tag push `v1.0.1` triggers build on all 3 platforms
- [ ] Artifacts uploaded to GitHub Releases
- [ ] Running app detects and offers new version update

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| macOS unsigned apps rejected by Gatekeeper | Users can't open | Document manual allow steps in README |
| GitHub Actions minutes exhausted | Builds fail | Use caching, optimize build matrix |
| Auto-update fails on macOS unsigned | Users stuck on old version | Provide manual download link |

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add electron-updater, update build config |
| `src/main/updater/auto-updater.ts` | Create | Auto-update logic module |
| `src/main/index.ts` | Modify | Import and initialize auto-updater |
| `.github/workflows/release.yml` | Create | CI/CD workflow |
| `README.md` | Modify | Add installation instructions |
