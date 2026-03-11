# Terminal Image Overlay

## Overview
Thêm khả năng hover/click vào image paths trong terminal để preview và xóa ảnh đính kèm.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Image Path Tracking | pending |
| 2 | Hover Detection + Preview Popup | pending |
| 3 | IPC Handlers (open/delete) | pending |
| 4 | Testing | pending |

## Key Files
- `src/renderer/stores/image-store.ts` (new)
- `src/renderer/hooks/use-terminal.ts` (modify)
- `src/renderer/components/terminal/image-preview-popup.tsx` (new)
- `src/main/ipc/handlers.ts` (modify)
- `src/shared/constants/ipc-channels.ts` (modify)
- `src/preload/index.ts` (modify)

## Architecture

```
User pastes image → save file → track in imageStore → insert path to terminal
                                     ↓
User hovers image path in terminal → detect via mousemove → show popup
                                     ↓
                              Preview popup with:
                              - Thumbnail image
                              - Click to open in native viewer
                              - X button to delete file
```
