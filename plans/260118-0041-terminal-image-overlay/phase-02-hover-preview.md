# Phase 2: Hover Detection + Preview Popup

## Overview
Detect hover trên image paths trong terminal và show popup preview.

## Implementation Steps

### 1. Create ImagePreviewPopup component
File: `src/renderer/components/terminal/image-preview-popup.tsx`

```tsx
interface ImagePreviewPopupProps {
  imagePath: string | null
  position: { x: number; y: number } | null
  onClose: () => void
  onDelete: (path: string) => void
  onOpen: (path: string) => void
}
```

Features:
- Show thumbnail (max 200x200)
- Click thumbnail → open in native viewer
- X button → delete file
- Auto-hide when mouse leaves

### 2. Update terminal-view.tsx
- Add hover detection on terminal container
- Use xterm's mouse API to get coordinates
- Parse line text to find image paths
- Show/hide popup based on hover state

### 3. CSS styles
- Popup styling in globals.css

## Detection Logic
```
mousemove on terminal
  → get row/col from mouse position
  → get line text from buffer
  → check if cursor is over image path pattern
  → if yes, show popup at mouse position
```

Image path patterns to detect:
- `/tmp/multiClaude-screenshots/screenshot-*.png`
- Quoted paths: `"/path/to/image.png"`

## Files to Modify
- `src/renderer/components/terminal/image-preview-popup.tsx` (create)
- `src/renderer/components/terminal/terminal-view.tsx` (add hover)
- `src/renderer/styles/globals.css` (popup styles)

## Todo
- [ ] Create ImagePreviewPopup component
- [ ] Add hover detection to terminal-view.tsx
- [ ] Add popup styles
