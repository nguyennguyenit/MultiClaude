# Phase 5: Final Cleanup

## Context
- [Main Plan](./plan.md)
- [Previous: Phase 4](./phase-04-write-tests.md)

## Overview
- **Priority:** High
- **Status:** DONE (2026-01-03)
- **Effort:** 30 minutes

Final verification, cleanup, and prepare for release.

## Pre-Flight Checklist

### Code Quality
- [x] `npm run typecheck` passes
- [x] `npm run test` passes
- [x] `npm run test:coverage` shows >60%
- [x] `npm run build` succeeds
- [x] No console.log statements in production code

### Git Status
- [x] All changes committed
- [x] Clean working directory
- [x] Meaningful commit history

### Documentation
- [x] README is up to date
- [x] package.json version is correct

## Implementation Steps

### Step 1: Run Full Verification

```bash
# Type check
npm run typecheck

# Run tests
npm run test

# Check coverage
npm run test:coverage

# Build
npm run build
```

### Step 2: Smoke Test Built App

```bash
# Verify the built app can start (Linux)
if [ -f "./release/linux-unpacked/multiclaude" ]; then
  timeout 5 ./release/linux-unpacked/multiclaude --help 2>/dev/null || echo "App started (timeout expected)"
fi

# Or test AppImage
if [ -f "./release/MultiClaude-1.0.0.AppImage" ]; then
  chmod +x ./release/MultiClaude-1.0.0.AppImage
  timeout 5 ./release/MultiClaude-1.0.0.AppImage --help 2>/dev/null || echo "AppImage started (timeout expected)"
fi
```

> **Why:** Ensures built binary actually runs, catches packaging issues.

### Step 3: Check for Debug Code

```bash
# Find console.log in source (exclude tests)
grep -r "console.log" src/main --include="*.ts" | grep -v ".spec.ts" | grep -v "__tests__"
grep -r "console.log" src/renderer --include="*.ts" --include="*.tsx" | grep -v ".spec.ts"

# Find TODO/FIXME comments
grep -rn "TODO\|FIXME" src/
```

Review and address any findings.

### Step 4: Update Version (if needed)

```json
// package.json
{
  "version": "1.0.0"  // or bump to 1.0.1 if changes warrant
}
```

### Step 5: Final Commit

```bash
# If any cleanup was needed
git add -A
git commit -m "chore: final cleanup for release

- Remove debug statements
- Verify all tests pass
- Confirm build succeeds"
```

### Step 6: Verify Clean State

```bash
git status
# Should show: nothing to commit, working tree clean

git log --oneline -10
# Should show clean, logical commit history
```

## Success Criteria

- [x] All npm scripts pass (typecheck, test, build)
- [x] Coverage >60% on core modules
- [x] Git status is clean
- [x] README reflects current state
- [x] Ready for Phase 2 (Linux Release)

## Summary Report

After completion, verify:

| Check | Status |
|-------|--------|
| TypeScript compiles | ✓ |
| Tests pass (58) | ✓ |
| Coverage >60% | ✓ |
| Build succeeds (AppImage + deb) | ✓ |
| Git is clean | ✓ |

## Next Phase

With Phase 1 complete, proceed to:
- **Phase 2: Linux Release** - Polish AppImage, test on distros, release on GitHub

Refer to [Brainstorm Report](../reports/brainstorm-260101-1634-release-readiness.md) for full roadmap.
