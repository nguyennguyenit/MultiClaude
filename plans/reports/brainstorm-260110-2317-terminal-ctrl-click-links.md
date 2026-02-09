# Brainstorm: Terminal Ctrl+Click Links

**Date:** 2026-01-10
**Status:** Approved

## Problem Statement

User wants to Ctrl+Click (Cmd+Click on macOS) on URLs in terminal to open them in system default browser, similar to VSCode/IntelliJ behavior.

## Requirements

| Requirement | Decision |
|-------------|----------|
| Browser target | System default browser |
| Trigger | Ctrl+Click (Cmd+Click on macOS) |
| Visual feedback | Underline + pointer cursor on hover |
| Confirmation | No dialog, open directly |

## Current State

- **Package:** `@xterm/addon-web-links@0.12.0` installed but not used
- **Location:** `src/renderer/hooks/use-terminal.ts` - xterm initialization
- **IPC:** No `shell.openExternal` bridge exists yet

## Evaluated Approaches

### Approach 1: WebLinksAddon (Selected) ✅

Load existing addon with custom Ctrl+Click handler.

**Pros:**
- Simple (~45 LOC)
- Built-in URL regex detection
- Automatic underline + hover decoration
- Package already installed

**Cons:**
- Only detects HTTP/HTTPS links

### Approach 2: Custom LinkProvider ❌

Implement `ILinkProvider` interface for full control.

**Rejected:** Over-engineering for current use case.

### Approach 3: Hybrid ❌

Start with WebLinksAddon, add custom patterns later.

**Rejected:** YAGNI - not needed now.

## Final Solution

Use `@xterm/addon-web-links` with custom handler that:
1. Checks for Ctrl/Cmd modifier key
2. Validates URL protocol (http/https only)
3. Opens in system browser via Electron `shell.openExternal`

## Implementation Plan

### Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/hooks/use-terminal.ts` | Import & load WebLinksAddon with custom handler |
| `src/preload/index.ts` | Add `shell.openExternal` IPC bridge |
| `src/main/ipc/` | Handle `shell:open-external` with URL validation |

### Code Snippets

**use-terminal.ts:**
```typescript
import { WebLinksAddon } from '@xterm/addon-web-links'

// In initTerminal(), after terminal.open():
const webLinksAddon = new WebLinksAddon(
  (event: MouseEvent, uri: string) => {
    if (event.ctrlKey || event.metaKey) {
      window.electron.shell.openExternal(uri)
    }
  }
)
terminal.loadAddon(webLinksAddon)
```

**preload.ts:**
```typescript
shell: {
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
}
```

**main/ipc handler:**
```typescript
ipcMain.handle('shell:open-external', async (_, url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    await shell.openExternal(url)
    return true
  }
  return false
})
```

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Malicious URLs | Validate protocol (http/https only) |
| XSS | Electron sandbox handles |
| Phishing | URLs visible in terminal before click |

## Success Metrics

- [ ] Hover over HTTP/HTTPS URLs shows underline + pointer cursor
- [ ] Ctrl+Click opens URL in system browser
- [ ] Regular click does not trigger (allows text selection)
- [ ] Works on both Ctrl (Windows/Linux) and Cmd (macOS)

## Complexity Estimate

| Task | LOC |
|------|-----|
| Load addon in use-terminal.ts | ~15 |
| IPC bridge (preload + type) | ~15 |
| Main process handler | ~15 |
| **Total** | **~45** |

## Next Steps

1. Implement using `/ck:plan:fast`
2. Test on all platforms
3. Update docs if needed
