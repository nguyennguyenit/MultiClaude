# Phase 2: Review & Commit Changes

## Context
- [Main Plan](./plan.md)
- [Previous: Phase 1](./phase-01-update-gitignore.md)

## Overview
- **Priority:** High
- **Status:** DONE
- **Effort:** 1.5 hours
- **Updated:** 2026-01-03

Review all modified and untracked files, commit in logical groups.

## Current Git Status Analysis

### Modified Files (11 files, +121/-159 lines)

| File | Changes | Category |
|------|---------|----------|
| `README.md` | +42/-8 | Documentation |
| `src/main/ipc/handlers.ts` | +11 | IPC handlers |
| `src/preload/index.ts` | +6 | Preload |
| `src/renderer/App.tsx` | +13 | UI |
| `src/renderer/components/sidebar/sidebar.tsx` | -19 | UI refactor |
| `src/renderer/components/terminal/terminal-grid.tsx` | +5/-1 | Terminal |
| `src/renderer/components/terminal/terminal-pane.tsx` | +43/-1 | Terminal |
| `src/renderer/components/terminal/terminal-view.tsx` | -115 | Terminal refactor |
| `src/renderer/hooks/use-file-drop.ts` | +7/-1 | Hooks |
| `src/renderer/main.tsx` | +14/-2 | Entry point |
| `src/shared/constants/ipc-channels.ts` | +5/-1 | Constants |

### Untracked Files (to commit)

| File/Folder | Category | Action |
|-------------|----------|--------|
| `.github/workflows/build.yml` | CI/CD | Commit |
| `index.html` | Entry point | Commit (main HTML entry) |
| `package-lock.json` | Config | Commit |
| `postcss.config.js` | Config | Commit |
| `tailwind.config.js` | Config | Commit |
| `tsconfig.json` | Config | Commit |
| `vite.config.ts` | Config | Commit |
| `src/main/git/` | New module | Commit |
| `src/main/ipc/index.ts` | New module | Commit |
| `src/main/project/index.ts` | New module | Commit |
| `src/main/terminal/` | New module | Commit |
| `src/renderer/components/sidebar/index.ts` | New module | Commit |
| `src/renderer/components/welcome-screen.tsx` | New component | Commit |
| `src/renderer/utils/file-drop-handler.ts` | New utility | Commit |
| `src/shared/constants/terminal-themes.ts` | Constants | Commit |

### Untracked Files (to ignore)

| File/Folder | Action |
|-------------|--------|
| `new-feature/` | In .gitignore (Phase 1) |
| `repomix-output.xml` | In .gitignore (Phase 1) |

## Implementation Steps

### Step 1: Commit CI/CD Pipeline

```bash
git add .github/
git commit -m "ci: add GitHub Actions build workflow

- Build on push/PR to master/main
- Matrix build for Linux, Windows, macOS
- Auto-release on version tags
- Upload artifacts for all platforms"
```

### Step 2: Commit Config Files

```bash
git add index.html package-lock.json postcss.config.js tailwind.config.js tsconfig.json vite.config.ts
git commit -m "chore: add build config files

- index.html entry point
- package-lock.json for reproducible installs
- postcss.config.js for Tailwind
- tailwind.config.js for styling
- tsconfig.json for TypeScript
- vite.config.ts for build"
```

### Step 3: Commit New Source Modules

```bash
git add src/main/git/ src/main/ipc/index.ts src/main/project/index.ts src/main/terminal/
git add src/renderer/components/sidebar/index.ts src/renderer/components/welcome-screen.tsx
git add src/renderer/utils/file-drop-handler.ts
git add src/shared/constants/terminal-themes.ts
git commit -m "feat: add core application modules

- git: GitManager for repository operations
- terminal: TerminalManager for PTY handling
- project: ProjectStore for persistence
- UI: sidebar, welcome screen components
- utils: file drop handler
- terminal-themes: color theme definitions"
```

### Step 4: Commit Modified Files (Terminal Refactor)

```bash
# Review changes first
git diff src/renderer/components/terminal/

# If changes look good (extracting logic from terminal-view)
git add src/renderer/components/terminal/ src/renderer/hooks/use-file-drop.ts
git commit -m "refactor(terminal): extract file drop and pane logic

- Move file drop handling to dedicated utility
- Simplify terminal-view component
- Enhance terminal-pane with expanded features
- Clean up terminal-grid"
```

### Step 5: Commit Remaining Changes

```bash
# Review remaining changes
git diff src/main/ipc/handlers.ts src/preload/index.ts
git diff src/renderer/App.tsx src/renderer/main.tsx
git diff src/renderer/components/sidebar/sidebar.tsx
git diff src/shared/constants/ipc-channels.ts

git add -A
git commit -m "feat: enhance IPC handlers and UI components

- Add new IPC channel handlers
- Update preload with new APIs
- Refine sidebar component
- Update App entry and main renderer"
```

### Step 6: Commit Documentation

```bash
git add README.md
git commit -m "docs: update README with latest features"
```

## Todo List

- [x] Commit CI/CD workflow (.github/)
- [x] Commit config files (index.html, package-lock, etc.)
- [x] Commit new source modules
- [x] Commit terminal refactor changes
- [x] Commit remaining IPC/UI changes
- [x] Commit README updates
- [x] Verify `git status` is clean (except ignored files)

## Success Criteria

- All meaningful changes committed
- Logical commit history (5-6 commits)
- No stray files in working directory
- `git log --oneline -10` shows clean history

## Next Steps

Proceed to [Phase 3: Setup Vitest](./phase-03-setup-vitest.md)
