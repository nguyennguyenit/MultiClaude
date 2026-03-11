# Scout Report: Image Attachment Functionality

## Overview
Complete file inventory for image attachment, preview, and deletion functionality in MultiClaude.

---

## Core Components

### 1. UI Components

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/image-preview-popup.tsx`**
- Image preview popup component shown on hover over image paths
- Features:
  - Loads image as base64 from file path
  - Shows thumbnail preview (180x120px max)
  - "Open" button - opens image in system viewer
  - "Delete" button - deletes image file
  - Appears above cursor position on hover
  - Auto-closes on mouse leave

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/components/terminal/terminal-view.tsx`**
- Terminal view with integrated image preview
- Features:
  - Mouse move detection over terminal content
  - Pattern matching for image paths: `/tmp/multiClaude-screenshots/screenshot-*.png`
  - Debounced hover detection (150ms)
  - Popup positioning based on cursor location
  - Integrates ImagePreviewPopup component
  - Calls delete handler via IPC

---

### 2. State Management

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/stores/image-store.ts`**
- Zustand store for tracking images per terminal
- State structure:
  ```typescript
  images: Record<string, ImageEntry[]>
  // ImageEntry: { filePath: string, timestamp: number }
  ```
- Methods:
  - `addImage(terminalId, filePath)` - Track new image
  - `removeImage(terminalId, filePath)` - Remove from tracking
  - `getImages(terminalId)` - Get terminal's images
  - `clearTerminal(terminalId)` - Clear all terminal images
  - `isTrackedImage(filePath)` - Check if image is tracked

---

### 3. Terminal Integration

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/hooks/use-terminal.ts`**
- Terminal hook with clipboard image paste handling
- Features:
  - Ctrl+V paste detection (lines 294-354)
  - Clipboard image extraction from clipboard API
  - Base64 encoding of pasted images
  - Auto-tracking pasted images in image store
  - Path formatting with shell escape handling
  - Auto-writes image path to terminal

---

### 4. IPC Bridge

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/preload/index.ts`**
- Electron API bridge
- Image-related APIs:
  ```typescript
  clipboard: {
    saveImage: (base64Data: string) => Promise<string | null>
  }
  image: {
    open: (filePath: string) => Promise<boolean>
    delete: (filePath: string) => Promise<boolean>
    readBase64: (filePath: string) => Promise<string | null>
  }
  ```

---

### 5. Main Process Handlers

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/main/ipc/handlers.ts`**
- IPC handlers for image operations (lines 465-503)
- Handlers:
  - `CLIPBOARD_SAVE_IMAGE` - Saves base64 image to temp folder
  - `IMAGE_OPEN` - Opens image in system default viewer
  - `IMAGE_DELETE` - Deletes image file (security: only `/multiClaude-screenshots/` paths)
  - `IMAGE_READ_BASE64` - Reads image as base64 (security: only `/multiClaude-screenshots/` paths)

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/main/clipboard/clipboard-handler.ts`**
- Clipboard image save implementation
- Features:
  - Creates temp directory: `/tmp/multiClaude-screenshots/`
  - Generates unique filenames: `screenshot-{timestamp}.png`
  - Converts base64 to buffer and writes to disk
  - Returns file path or null on error

---

### 6. Constants

**`/home/plateau/Desktop/Claude Code/MultiClaude/src/shared/constants/ipc-channels.ts`**
- IPC channel definitions (lines 92-98):
  ```typescript
  CLIPBOARD_SAVE_IMAGE: 'clipboard:save-image'
  IMAGE_OPEN: 'image:open'
  IMAGE_DELETE: 'image:delete'
  IMAGE_READ_BASE64: 'image:read-base64'
  ```

---

## Data Flow

### Paste Image Flow
1. User pastes (Ctrl+V) in terminal
2. `use-terminal.ts` detects paste, extracts clipboard image
3. Converts to base64, calls `window.electron.clipboard.saveImage()`
4. IPC → Main process → `clipboard-handler.ts` saves to `/tmp/multiClaude-screenshots/`
5. Returns file path → `use-terminal.ts` adds to image store
6. Writes escaped path to terminal

### Preview Image Flow
1. User hovers over image path in terminal
2. `terminal-view.tsx` detects hover via mouse move handler
3. Regex matches path pattern in terminal buffer
4. Shows `ImagePreviewPopup` at cursor position
5. Popup calls `window.electron.image.readBase64()` to load preview
6. IPC → Main reads file, returns base64 → Popup displays

### Delete Image Flow
1. User clicks "Delete" in preview popup
2. `terminal-view.tsx` calls `handleDeleteImage()`
3. Calls `window.electron.image.delete(filePath)`
4. IPC → Main → `handlers.ts` deletes file (validates path security)
5. Returns success → Removes from image store
6. Closes popup

---

## Security Considerations

**Path Restrictions:**
- `IMAGE_DELETE` and `IMAGE_READ_BASE64` only allow paths containing `'multiClaude-screenshots'`
- Prevents arbitrary file system access
- Implemented in `/home/plateau/Desktop/Claude Code/MultiClaude/src/main/ipc/handlers.ts` lines 481, 494

---

## File Summary

**Total Files: 8**

**Frontend (4 files):**
- `src/renderer/components/terminal/image-preview-popup.tsx` - Preview UI
- `src/renderer/components/terminal/terminal-view.tsx` - Terminal integration
- `src/renderer/hooks/use-terminal.ts` - Paste handler
- `src/renderer/stores/image-store.ts` - State management

**Backend (2 files):**
- `src/main/ipc/handlers.ts` - IPC handlers
- `src/main/clipboard/clipboard-handler.ts` - File save logic

**Shared (2 files):**
- `src/preload/index.ts` - IPC bridge
- `src/shared/constants/ipc-channels.ts` - Channel constants

---

## Key Features

1. **Clipboard Integration**: Auto-detects and saves pasted images
2. **Hover Preview**: Shows thumbnail on hover with 150ms debounce
3. **Quick Actions**: Open in viewer or delete from popup
4. **State Tracking**: Per-terminal image tracking via Zustand
5. **Security**: Path validation to prevent unauthorized file access
6. **Shell Escaping**: Auto-quotes paths with special characters
