# Phase 1: Image Path Tracking

## Overview
Track pasted images per terminal để biết image paths nào cần show preview.

## Implementation Steps

### 1. Create image store
File: `src/renderer/stores/image-store.ts`

```typescript
// Track pasted images per terminal
interface ImageEntry {
  filePath: string
  timestamp: number
}

interface ImageStore {
  images: Record<string, ImageEntry[]>  // terminalId → images
  addImage: (terminalId: string, filePath: string) => void
  removeImage: (terminalId: string, filePath: string) => void
  getImages: (terminalId: string) => ImageEntry[]
  clearTerminal: (terminalId: string) => void
}
```

### 2. Update use-terminal.ts
- Import imageStore
- Call `addImage()` when clipboard image is saved (line ~320)

### 3. Export from stores/index.ts

## Files to Modify
- `src/renderer/stores/image-store.ts` (create)
- `src/renderer/stores/index.ts` (export)
- `src/renderer/hooks/use-terminal.ts` (add tracking)

## Todo
- [ ] Create image-store.ts
- [ ] Export from stores/index.ts
- [ ] Update use-terminal.ts to track pasted images
