# Brainstorm: Production Build & Distribution Setup

**Date:** 2026-01-03
**Status:** Approved for Implementation

## Problem Statement

Setup production build pipeline for MultiClaude to enable public release across all platforms (Linux, Windows, macOS) with auto-update capability.

## Requirements

| Requirement | Decision |
|-------------|----------|
| Platforms | All (Linux, Windows, macOS) |
| Distribution | Public Release |
| CI/CD | GitHub Actions |
| Code Signing | Skip (accept warnings) |
| Auto-update | Enabled |

## Current State

| Component | Status |
|-----------|--------|
| electron-builder config | Exists in package.json |
| GitHub Actions workflow | Missing |
| electron-updater | Not installed |
| Auto-update integration | Not implemented |

## Recommended Solution

### 1. Install electron-updater
- Add dependency for auto-update functionality
- Works with GitHub Releases out of the box

### 2. GitHub Actions Workflow
- Build matrix: ubuntu-latest, windows-latest, macos-latest
- Trigger: On tag push (v*)
- Publish: GitHub Releases via electron-builder

### 3. Auto-Update Integration
- Check for updates on app startup
- Show notification when update available
- Download and install on user confirmation

## Trade-offs

| Aspect | Pro | Con |
|--------|-----|-----|
| Skip Signing | Free, simpler setup | Warning dialogs on Win/Mac |
| GitHub Actions | Free for public repos, automated | Build minutes limited |
| electron-updater | Easy GitHub integration | macOS unsigned apps may fail update |

## Platform-Specific Notes

### macOS (No Signing)
- Gatekeeper blocks unsigned apps
- Users must: Right-click → Open → Open
- Auto-update may require manual allow each version

### Windows (No Signing)
- SmartScreen warning on first run
- Users: "More info" → "Run anyway"
- Auto-update works normally after first allow

### Linux
- No signing issues
- AppImage and .deb work without restrictions

## Success Criteria

- [ ] `npm run build` produces installers for current platform
- [ ] GitHub Actions builds all 3 platforms on tag push
- [ ] Artifacts published to GitHub Releases
- [ ] Auto-update checks and downloads new versions
- [ ] Users can install and run on all platforms

## Next Steps

Create detailed implementation plan with phases:
1. Add electron-updater dependency
2. Implement auto-update in main process
3. Create GitHub Actions workflow
4. Test release process
