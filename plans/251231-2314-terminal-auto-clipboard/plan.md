# Plan: Terminal Auto Copy/Paste

**Created:** 2025-12-31
**Status:** DONE (Completed: 2025-12-31 23:52)
**Complexity:** Low
**Reference:** [Brainstorm Report](../reports/brainstorm-251231-2314-terminal-auto-clipboard.md)

---

## Overview

Add auto-copy on selection and auto-paste on right-click to xterm.js terminal.

| Feature | Behavior |
|---------|----------|
| Auto-copy | Copy to clipboard when mouse released after selection |
| Quick-paste | Paste on right-click (no context menu) |
| Feedback | None (silent operation) |
| Selection | Keep after copy |

---

## Implementation

### File: `src/renderer/hooks/use-terminal.ts`

**Insertion point:** Line 54, after `fitAddon.fit()`, before `// Handle input`

### Code to Add

```typescript
    // Auto-copy on selection complete
    terminal.element?.addEventListener('mouseup', async () => {
      const selection = terminal.getSelection()
      if (selection) {
        try {
          await navigator.clipboard.writeText(selection)
        } catch {
          // Clipboard permission denied - ignore silently
        }
      }
    })

    // Right-click paste (prevent context menu)
    terminal.element?.addEventListener('contextmenu', async (e) => {
      e.preventDefault()
      try {
        const text = await navigator.clipboard.readText()
        if (text) terminal.paste(text)
      } catch {
        // Clipboard permission denied - ignore silently
      }
    })
```

---

## Implementation Steps

### Step 1: Edit use-terminal.ts

1. Open `src/renderer/hooks/use-terminal.ts`
2. Locate `fitAddon.fit()` (line 54)
3. Add clipboard event handlers after it
4. Save file

### Step 2: Test

Run dev server and verify:
- [ ] Select text in terminal → check clipboard has text
- [ ] Right-click → text from clipboard pastes into terminal
- [ ] Click without selection → clipboard not overwritten
- [ ] Right-click with empty clipboard → no error, nothing happens
- [ ] Double-click to select word → auto-copies correctly
- [ ] Ctrl+C/V still work → no conflict

### Step 3: Build Verification

```bash
npm run build
```

Ensure no TypeScript errors.

---

## Technical Notes

- **Clipboard API**: `navigator.clipboard` async API (modern, Electron-safe)
- **Event cleanup**: Not needed - listeners attach to `terminal.element` which gets disposed with terminal
- **Error handling**: Silent try-catch for permission denied edge cases
- **No dependencies**: Uses native browser APIs only

---

## Risks

| Risk | Mitigation |
|------|------------|
| Clipboard permission denied | Silent fail via try-catch |
| Conflict with Ctrl+C/V | Additive, doesn't override |

---

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/hooks/use-terminal.ts` | Add ~20 lines for clipboard handlers |

---

## Success Criteria

- Auto-copy works on any text selection
- Right-click paste works instantly
- No perceivable lag
- No conflicts with existing features
- Build passes without errors
