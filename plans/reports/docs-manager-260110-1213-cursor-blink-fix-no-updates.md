# Documentation Review: Cursor Blink Fix

**Task:** Review docs for cursor blink bugfix in `App.tsx` `handleSelectProject`

**Changes Analyzed:**
- Added `setActiveTerminal(null)` when switching to null project
- Added auto-select first terminal after `setActiveProject(id)`
- Updated useCallback deps

**Documentation Review Results:**

## Files Checked
- `docs/codebase-summary.md` ✓
- `docs/system-architecture.md` ✓

## Findings
**No updates required.**

### Rationale
1. **Function not documented**: `handleSelectProject` is not referenced in existing docs
2. **Implementation detail**: Cursor blink fix is component-level behavior, not architectural change
3. **Different context**: Existing `setActiveTerminal` docs relate to notification FocusDetector (IPC-level), not UI state management

### Existing `setActiveTerminal` Coverage
Docs correctly describe notification system usage:
- `FocusDetector`: Window/terminal focus tracking for suppressing notifications
- `App.tsx Active Terminal Sync`: useEffect syncs `activeTerminalId` with `notification.setActiveTerminal` IPC

**Decision:** Docs focus on feature/architecture-level concepts. Function-level bugfixes don't warrant updates unless they change documented APIs or system behavior.

---
**Completed:** 2026-01-10 12:13
