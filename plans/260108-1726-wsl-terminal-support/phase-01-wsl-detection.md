# Phase 1: WSL Detection (Backend)

**Effort**: 1.5h

## Objective

Create a utility to detect WSL availability and list installed distros.

## Tasks

### 1.1 Create WSL Detector Utility

**File**: `src/main/terminal/wsl-detector.ts` (CREATE)

```typescript
import { execSync } from 'child_process'

export interface WslDistro {
  name: string
  isDefault: boolean
}

export interface WslInfo {
  available: boolean
  distros: WslDistro[]
}

/**
 * Detect WSL availability and installed distros (Windows only)
 * Returns { available: false, distros: [] } on non-Windows platforms
 */
export function detectWsl(): WslInfo {
  if (process.platform !== 'win32') {
    return { available: false, distros: [] }
  }

  try {
    // wsl --list --quiet returns distro names, one per line
    // Default distro has * prefix (only in verbose mode)
    const output = execSync('wsl --list --quiet', {
      encoding: 'utf-8',
      timeout: 5000,
      windowsHide: true
    })

    // Parse output - remove empty lines and BOM
    const lines = output
      .replace(/^\uFEFF/, '') // Remove UTF-16 BOM if present
      .split('\n')
      .map(line => line.trim().replace(/\0/g, '')) // Remove null bytes (Windows encoding)
      .filter(line => line.length > 0)

    if (lines.length === 0) {
      return { available: false, distros: [] }
    }

    // Get default distro name
    let defaultDistro = ''
    try {
      const defaultOutput = execSync('wsl --list --verbose', {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true
      })
      const defaultMatch = defaultOutput.match(/^\s*\*\s+(\S+)/m)
      if (defaultMatch) {
        defaultDistro = defaultMatch[1]
      }
    } catch {
      // Ignore - just won't mark default
    }

    const distros: WslDistro[] = lines.map(name => ({
      name,
      isDefault: name === defaultDistro
    }))

    return { available: true, distros }
  } catch {
    // WSL not installed or command failed
    return { available: false, distros: [] }
  }
}

/**
 * Check if WSL is available (quick check)
 */
export function isWslAvailable(): boolean {
  if (process.platform !== 'win32') return false

  try {
    execSync('wsl --status', {
      encoding: 'utf-8',
      timeout: 3000,
      windowsHide: true
    })
    return true
  } catch {
    return false
  }
}
```

### 1.2 Add IPC Channel

**File**: `src/shared/constants/ipc-channels.ts` (MODIFY)

Add after `TERMINAL_TITLE_CHANGE`:
```typescript
TERMINAL_DETECT_WSL: 'terminal:detect-wsl',
```

### 1.3 Register IPC Handler

**File**: `src/main/ipc/handlers.ts` (MODIFY)

Add import:
```typescript
import { detectWsl } from '../terminal/wsl-detector'
```

Add handler after terminal handlers:
```typescript
ipcMain.handle(IPC_CHANNELS.TERMINAL_DETECT_WSL, async () => {
  return detectWsl()
})
```

### 1.4 Update Preload API

**File**: `src/preload/index.ts` (MODIFY)

Add to ElectronAPI interface and contextBridge:
```typescript
detectWsl: () => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DETECT_WSL),
```

## Acceptance Criteria

- [x] `detectWsl()` returns correct info on Windows with WSL
- [x] Returns `{ available: false, distros: [] }` on Windows without WSL
- [x] Returns `{ available: false, distros: [] }` on macOS/Linux
- [x] IPC channel works from renderer
- [x] No hanging/timeout issues

## Testing Notes

Test manually on Windows:
```bash
# With WSL installed
wsl --list --quiet
# Should return distro names

# Without WSL (or disabled)
# Command should fail
```
