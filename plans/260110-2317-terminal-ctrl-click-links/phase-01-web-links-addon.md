# Phase 01: Load WebLinksAddon

## Context

- **Parent Plan**: [plan.md](./plan.md)
- **Brainstorm**: [brainstorm-260110-2317-terminal-ctrl-click-links.md](../reports/brainstorm-260110-2317-terminal-ctrl-click-links.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-10 |
| Priority | P2 |
| Implementation | ✅ Done (2026-01-10) |
| Review | ✅ Done (2026-01-10) |
| Effort | 30m |

## Key Insights

1. **Package already installed** - `@xterm/addon-web-links@0.12.0` in package.json
2. **IPC already exists** - `window.electron.app.openExternal(url)` ready to use
3. **Only 1 file needs modification** - `src/renderer/hooks/use-terminal.ts`
4. **Security gap** - Current handler at `handlers.ts:343` doesn't validate URL protocol

## Requirements

- [x] Hover over HTTP/HTTPS URLs shows underline + pointer cursor
- [x] Ctrl+Click (Cmd+Click on macOS) opens URL in system browser
- [x] Regular click does NOT trigger (preserves text selection)
- [x] Only http:// and https:// URLs are opened (security)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     use-terminal.ts                          │
├─────────────────────────────────────────────────────────────┤
│  Terminal Init                                               │
│  ┌──────────────┐                                           │
│  │ WebLinksAddon│──▶ Detects URLs, shows underline on hover │
│  │   handler    │──▶ Checks event.ctrlKey || event.metaKey  │
│  │              │──▶ Validates http:// or https://          │
│  │              │──▶ Calls window.electron.app.openExternal │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     handlers.ts (main)                       │
├─────────────────────────────────────────────────────────────┤
│  ipcMain.on(APP_OPEN_EXTERNAL) → shell.openExternal(url)    │
└─────────────────────────────────────────────────────────────┘
```

## Related Code Files

| File | Purpose |
|------|---------|
| `src/renderer/hooks/use-terminal.ts` | Main modification - load addon |
| `src/main/ipc/handlers.ts:343-347` | Existing handler (optional: add validation) |
| `src/preload/index.ts:240-241` | Existing API - no changes needed |

## Implementation Steps

### Step 1: Import WebLinksAddon

**File:** `src/renderer/hooks/use-terminal.ts`

Add import at top (near other xterm imports):

```typescript
import { WebLinksAddon } from '@xterm/addon-web-links'
```

### Step 2: Load addon in initTerminal()

**File:** `src/renderer/hooks/use-terminal.ts`

Inside `initTerminal()`, after `terminal.open(container)` (around line 120), add:

```typescript
// Load web links addon for Ctrl+Click URL opening
const webLinksAddon = new WebLinksAddon(
  (event: MouseEvent, uri: string) => {
    // Only open on Ctrl+Click (Windows/Linux) or Cmd+Click (macOS)
    if (event.ctrlKey || event.metaKey) {
      // Security: only allow http/https URLs
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        window.electron.app.openExternal(uri)
      }
    }
  }
)
terminal.loadAddon(webLinksAddon)
```

### Step 3: (Optional) Add server-side validation

**File:** `src/main/ipc/handlers.ts`

Update existing handler at line 343-347 to add protocol validation:

```typescript
ipcMain.on(IPC_CHANNELS.APP_OPEN_EXTERNAL, (_, url: string) => {
  // Security: only allow http/https URLs
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url)
  }
})
```

## Todo List

- [ ] Import WebLinksAddon in use-terminal.ts
- [ ] Add WebLinksAddon with Ctrl+Click handler
- [ ] Add URL protocol validation (client-side)
- [ ] (Optional) Add URL validation to handlers.ts
- [ ] Test: Hover shows underline + pointer cursor
- [ ] Test: Ctrl+Click opens in browser
- [ ] Test: Regular click doesn't trigger
- [ ] Test: Works on macOS with Cmd+Click

## Success Criteria

| Criteria | Validation |
|----------|------------|
| URL hover decoration | Visual: underline + pointer cursor |
| Ctrl+Click opens browser | Click http/https URL with Ctrl held |
| Text selection preserved | Click without modifier selects text |
| Cross-platform | Test on Windows, Linux, macOS |
| Security | Only http/https protocols work |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebLinksAddon conflicts with existing terminal handlers | Low | Addon is isolated, only affects link detection |
| Performance impact from URL regex scanning | Low | Addon is lightweight, built-in regex |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Malicious URLs (javascript:, file:, etc.) | Validate protocol client-side AND server-side |
| Phishing | User sees URL in terminal before clicking |
| Command injection | URLs passed through shell.openExternal which sanitizes |

## Next Steps

1. Implement changes in `use-terminal.ts`
2. Test all platforms
3. Run tester agent for verification
4. Update docs if needed
