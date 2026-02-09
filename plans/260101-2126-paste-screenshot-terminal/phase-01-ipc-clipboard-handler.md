# Phase 1: IPC Handler for Clipboard Image

## Context

- Plan: [plan.md](./plan.md)
- Related: [File Drop feature](../260101-1653-file-drop-terminal/)

## Overview

| Field | Value |
|-------|-------|
| Priority | P2 |
| Status | Done ✓ 2026-01-01 |
| Effort | 2h |

Create IPC handler in main process to save clipboard image to temp folder and return file path.

## Requirements

### Functional
- Save clipboard image to temp folder
- Generate unique filename with timestamp
- Return file path to renderer
- Create temp directory if not exists

### Non-functional
- Cross-platform (Linux, macOS, Windows)
- Fast execution (< 100ms)
- No memory leaks (proper buffer cleanup)

## Architecture

```
Main Process
├── clipboard-handler.ts (NEW)
│   ├── saveClipboardImage(): Promise<string | null>
│   │   ├── Read image from clipboard (nativeImage)
│   │   ├── Check if image is empty → return null
│   │   ├── Ensure temp directory exists
│   │   ├── Generate filename: screenshot-{timestamp}.png
│   │   ├── Write PNG buffer to file
│   │   └── Return file path
│   └── getScreenshotDir(): string
│       └── Returns: {tmpdir}/multiClaude-screenshots/
│
├── ipc/handlers.ts (MODIFY)
│   └── Add: CLIPBOARD_SAVE_IMAGE handler
│
└── shared/constants/ipc-channels.ts (MODIFY)
    └── Add: CLIPBOARD_SAVE_IMAGE channel
```

## Related Code Files

### Create
| File | Description |
|------|-------------|
| `src/main/clipboard/clipboard-handler.ts` | Clipboard image save logic |

### Modify
| File | Description |
|------|-------------|
| `src/shared/constants/ipc-channels.ts` | Add CLIPBOARD_SAVE_IMAGE channel |
| `src/main/ipc/handlers.ts` | Register clipboard IPC handler |
| `src/preload/index.ts` | Expose clipboard API to renderer |

## Implementation Steps

### Step 1: Add IPC Channel

Modify `src/shared/constants/ipc-channels.ts`:

```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...

  // Clipboard channels
  CLIPBOARD_SAVE_IMAGE: 'clipboard:save-image'
} as const
```

---

### Step 2: Create Clipboard Handler

Create `src/main/clipboard/clipboard-handler.ts`:

```typescript
import { clipboard, nativeImage } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Get directory for saving screenshots
 */
export function getScreenshotDir(): string {
  const dir = join(tmpdir(), 'multiClaude-screenshots')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Generate unique filename for screenshot
 */
function generateFilename(): string {
  const timestamp = Date.now()
  return `screenshot-${timestamp}.png`
}

/**
 * Save clipboard image to temp folder
 * @returns File path if image exists, null otherwise
 */
export function saveClipboardImage(): string | null {
  const image = clipboard.readImage()

  // Check if clipboard has an image
  if (image.isEmpty()) {
    return null
  }

  const dir = getScreenshotDir()
  const filename = generateFilename()
  const filePath = join(dir, filename)

  // Get PNG buffer and write to file
  const buffer = image.toPNG()
  writeFileSync(filePath, buffer)

  return filePath
}
```

---

### Step 3: Register IPC Handler

Modify `src/main/ipc/handlers.ts`:

Add import at top:
```typescript
import { saveClipboardImage } from '../clipboard/clipboard-handler'
```

Add handler inside `registerIpcHandlers` function (before closing brace):
```typescript
  // Clipboard handlers
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_SAVE_IMAGE, async () => {
    return saveClipboardImage()
  })
```

---

### Step 4: Expose API in Preload

Modify `src/preload/index.ts`:

Add to `ElectronAPI` interface:
```typescript
  clipboard: {
    saveImage: () => Promise<string | null>
  }
```

Add to `api` object:
```typescript
  clipboard: {
    saveImage: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_SAVE_IMAGE)
  }
```

---

## Todo List

- [ ] Add `CLIPBOARD_SAVE_IMAGE` to IPC channels
- [ ] Create `src/main/clipboard/clipboard-handler.ts`
- [ ] Add clipboard IPC handler in `handlers.ts`
- [ ] Expose `clipboard.saveImage()` in preload
- [ ] Test: Copy image to clipboard → call saveImage → verify file created
- [ ] Test: No image in clipboard → returns null
- [ ] Test: Verify temp directory created

## Success Criteria

- [ ] `window.electron.clipboard.saveImage()` returns file path when image in clipboard
- [ ] Returns `null` when no image in clipboard
- [ ] File saved to `/tmp/multiClaude-screenshots/` (Linux/macOS)
- [ ] File saved to `%TEMP%\multiClaude-screenshots\` (Windows)
- [ ] PNG format with proper data
- [ ] Unique filename for each save

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large image memory issue | Low | Medium | PNG compression, buffer cleanup by GC |
| Temp folder permission denied | Very Low | High | Use `os.tmpdir()` which is always writable |
| Clipboard read fails | Low | Medium | Check `isEmpty()` before processing |

## Security Considerations

- **No arbitrary file write** - Only writes to temp folder
- **No external input** - Reads from system clipboard only
- **Sandboxed location** - Uses OS temp directory
