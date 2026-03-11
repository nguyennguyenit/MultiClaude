# Phase 4: Testing + Validation

## Context Links
- Parent plan: [plan.md](./plan.md)
- Previous: [phase-03](./phase-03-renderer-migration.md)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Description:** Verify settings persistence works on Windows, macOS, and Linux

## Key Insights
- Primary test: Windows (the broken platform)
- Regression test: macOS/Linux (should still work)
- Check electron-store file exists at expected location

## Requirements
- [ ] Manual test on Windows
- [ ] Verify on macOS/Linux (if available)
- [ ] Build passes
- [ ] No TypeScript errors

## Testing Protocol

### Step 1: Build verification
```bash
npm run build
```
Ensure no TypeScript or build errors.

### Step 2: Development mode test
```bash
npm run electron:dev
```

1. Open Settings → Appearance
2. Change Color Theme (e.g., Default → Retro)
3. Change any other setting
4. Close app completely (not just window)
5. Reopen app
6. **Expected:** Theme persists

### Step 3: Windows production test
```bash
npm run release:win  # or build local .exe
```

1. Install/run production build on Windows
2. Change settings
3. Restart app
4. **Expected:** Settings persist

### Step 4: File verification
Check electron-store file exists:

**Windows:**
```
%APPDATA%\multiclaude\multiclaude-settings.json
```

**macOS:**
```
~/Library/Application Support/multiclaude/multiclaude-settings.json
```

**Linux:**
```
~/.config/multiclaude/multiclaude-settings.json
```

## Todo List
- [ ] Run `npm run build` - verify no errors
- [ ] Test settings persistence in dev mode
- [ ] Test on Windows production build
- [ ] Verify settings file exists on disk
- [ ] Test localStorage migration (if old data exists)

## Success Criteria
- [ ] Settings persist after app restart on Windows
- [ ] Settings persist after app restart on macOS/Linux
- [ ] No perceivable UI delay
- [ ] Old localStorage data migrated successfully

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Platform-specific path issues | Medium | electron-store handles this |
| File permission errors | Low | electron-store handles this |

## Rollback Plan
If issues found:
1. Revert settings-store.ts to localStorage version
2. Keep SettingsStore class for future fix
3. Document findings

## Next Steps
- Mark plan as complete
- Update codebase-summary.md with new architecture
- Close related issue
