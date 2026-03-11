# Phase 02: Venv Detector Module

## Context
- Parent: [plan.md](./plan.md)
- Dependencies: Phase 01 (Types)

## Overview
- **Priority**: P1
- **Status**: ⏳ Pending
- **Effort**: 30m

Create a module to detect Python virtual environments in project directories.

## Key Insights
- VSCode priority: `.venv` > `venv` > `env`
- Must check activation script exists, not just folder
- Different activation scripts per platform/shell:
  - Unix: `bin/activate`
  - Windows CMD: `Scripts/activate.bat`
  - Windows PowerShell: `Scripts/Activate.ps1`

## Requirements

### Functional
- FR-01: Detect venv folders with priority order
- FR-02: Verify activation script exists
- FR-03: Return venv path or null

### Non-Functional
- NFR-01: Synchronous check OK (small file system operation)
- NFR-02: Fail silently - return null on any error

## Architecture

```
detectPythonVenv(projectPath: string): string | null
  ├── Check .venv/bin/activate (Unix) or .venv/Scripts/activate.bat (Win)
  ├── Check venv/bin/activate or venv/Scripts/activate.bat
  ├── Check env/bin/activate or env/Scripts/activate.bat
  └── Return first match or null
```

## Related Code Files

### Create
- `src/main/terminal/venv-detector.ts` - Venv detection logic

### Reference (read-only)
- `src/main/terminal/wsl-detector.ts` - Similar pattern for platform detection

## Implementation Steps

1. **Create venv-detector.ts**
   ```typescript
   // src/main/terminal/venv-detector.ts
   import { existsSync } from 'fs'
   import { join } from 'path'

   /** Priority order for venv folder detection */
   const VENV_FOLDER_PATTERNS = ['.venv', 'venv', 'env'] as const

   /**
    * Detect Python virtual environment in project directory.
    * @param projectPath - Absolute path to project
    * @returns Absolute path to venv folder or null if not found
    */
   export function detectPythonVenv(projectPath: string): string | null {
     for (const pattern of VENV_FOLDER_PATTERNS) {
       const venvPath = join(projectPath, pattern)
       const activatePath = getActivationScriptPath(venvPath)

       if (existsSync(activatePath)) {
         return venvPath
       }
     }
     return null
   }

   /**
    * Get platform-specific activation script path.
    * @param venvPath - Path to venv folder
    */
   function getActivationScriptPath(venvPath: string): string {
     if (process.platform === 'win32') {
       // Check .bat first (works with CMD and some shells)
       return join(venvPath, 'Scripts', 'activate.bat')
     }
     return join(venvPath, 'bin', 'activate')
   }

   /**
    * Get activation command for a given shell type.
    * @param venvPath - Absolute path to venv folder
    * @param shellType - Shell type: 'bash', 'cmd', 'powershell', 'wsl'
    */
   export function getActivationCommand(
     venvPath: string,
     shellType: 'bash' | 'cmd' | 'powershell' | 'wsl'
   ): string {
     switch (shellType) {
       case 'cmd':
         return `"${venvPath}\\Scripts\\activate.bat"\r`
       case 'powershell':
         return `& "${venvPath}\\Scripts\\Activate.ps1"\r`
       case 'wsl':
         // WSL needs Linux-style path
         const wslPath = venvPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/mnt/${d.toLowerCase()}`)
         return `source "${wslPath}/bin/activate"\n`
       case 'bash':
       default:
         return `source "${venvPath}/bin/activate"\n`
     }
   }
   ```

2. **Export from index.ts** (`src/main/terminal/index.ts`)
   ```typescript
   export * from './venv-detector'
   ```

## Todo List
- [ ] Create venv-detector.ts with detectPythonVenv function
- [ ] Add getActivationCommand helper
- [ ] Export from terminal/index.ts
- [ ] Verify compilation

## Success Criteria
- [ ] detectPythonVenv returns path when venv exists
- [ ] Returns null when no venv
- [ ] getActivationCommand returns correct command per shell
- [ ] TypeScript compiles

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| .env folder conflict | Medium | Exclude from patterns (dotenv files) |
| Symlinked venv | Low | existsSync follows symlinks |
| Permission denied | Low | Fail silently, return null |

## Security Considerations
- Paths are escaped in quotes to prevent injection
- Only checks existence, no execution

## Next Steps
→ Phase 03: Terminal Manager Integration
