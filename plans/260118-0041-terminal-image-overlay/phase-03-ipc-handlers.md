# Phase 3: IPC Handlers

## Overview
Thêm IPC handlers để open và delete images từ renderer process.

## Implementation Steps

### 1. Add IPC channels
File: `src/shared/constants/ipc-channels.ts`

```typescript
IMAGE_OPEN: 'image:open',
IMAGE_DELETE: 'image:delete',
```

### 2. Add main process handlers
File: `src/main/ipc/handlers.ts`

```typescript
// Open image in native viewer
ipcMain.handle(IPC_CHANNELS.IMAGE_OPEN, (_, filePath: string) => {
  shell.openPath(filePath)
})

// Delete image file
ipcMain.handle(IPC_CHANNELS.IMAGE_DELETE, (_, filePath: string) => {
  if (existsSync(filePath) && filePath.includes('multiClaude-screenshots')) {
    unlinkSync(filePath)
    return true
  }
  return false
})
```

### 3. Add preload bindings
File: `src/preload/index.ts`

```typescript
image: {
  open: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_OPEN, filePath),
  delete: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_DELETE, filePath),
}
```

## Security
- Only allow deleting files in `multiClaude-screenshots` directory
- Validate file path before operations

## Files to Modify
- `src/shared/constants/ipc-channels.ts`
- `src/main/ipc/handlers.ts`
- `src/preload/index.ts`

## Todo
- [ ] Add IPC channel constants
- [ ] Add main process handlers
- [ ] Add preload bindings
