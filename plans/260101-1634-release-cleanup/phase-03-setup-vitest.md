# Phase 3: Setup Vitest Testing Framework

## Context
- [Main Plan](./plan.md)
- [Previous: Phase 2](./phase-02-commit-changes.md)

## Overview
- **Priority:** High
- **Status:** DONE (2026-01-03)
- **Effort:** 1 hour

Setup Vitest as the testing framework for the Electron/Vite project.

## Why Vitest

| Feature | Vitest | Jest |
|---------|--------|------|
| Vite integration | Native | Requires config |
| ESM support | Native | Requires transform |
| Speed | Fast | Slower |
| TypeScript | Built-in | Requires ts-jest |
| Electron main process | Works | Works |

## Related Code Files

| Action | File |
|--------|------|
| Modify | `package.json` |
| Create | `vitest.config.ts` |
| Create | `src/main/__tests__/setup.ts` |

## Implementation Steps

### Step 1: Install Dependencies

```bash
npm install -D vitest @vitest/coverage-v8
```

> **Note:** `vitest-mock-extended` removed - `vi.mock()` built-in is sufficient (YAGNI).

### Step 2: Create vitest.config.ts

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import path from 'path'

// ESM-compatible __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'release'],
    setupFiles: ['src/main/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/main/**/*.ts'],
      exclude: [
        'src/main/**/*.{test,spec}.ts',
        'src/main/**/index.ts',
        'src/main/index.ts'
      ],
      thresholds: {
        global: {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60
        }
      }
    },
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer')
    }
  }
})
```

> **Changes from original:**
> - Added `fileURLToPath` for ESM-compatible `__dirname`
> - Added `setupFiles` to load global mocks
> - Lowered coverage threshold to 60% (realistic for initial release)

### Step 3: Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

> **Removed:** `test:ui` script (YAGNI - not needed for release prep)

### Step 4: Create Test Setup File

```typescript
// src/main/__tests__/setup.ts
import { vi } from 'vitest'

// Mock electron-store globally
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private data: Record<string, unknown> = {}

      constructor(options?: { defaults?: Record<string, unknown> }) {
        if (options?.defaults) {
          this.data = { ...options.defaults }
        }
      }

      get(key: string) {
        return this.data[key]
      }

      set(key: string, value: unknown) {
        this.data[key] = value
      }
    }
  }
})

// Mock node-pty for terminal tests
vi.mock('@lydell/node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn()
  }))
}))
```

### Step 5: Update tsconfig.json for Tests

Add to `compilerOptions`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

### Step 6: Verify Setup

```bash
# Create a simple test to verify setup
echo 'import { describe, it, expect } from "vitest"

describe("Setup", () => {
  it("works", () => {
    expect(1 + 1).toBe(2)
  })
})' > src/main/__tests__/setup.spec.ts

# Run test
npm run test
```

## Todo List

- [x] Install vitest, @vitest/coverage-v8
- [x] Create vitest.config.ts (with ESM-compatible __dirname)
- [x] Add test scripts to package.json
- [x] Create test setup file with mocks
- [x] Update tsconfig.json for vitest globals
- [x] Verify setup with simple test
- [x] Commit testing infrastructure

## Success Criteria

- `npm run test` executes without errors
- `npm run test:coverage` generates coverage report
- Mocks for electron-store and node-pty work

## Commit Message

```
chore: setup vitest testing framework

- Add vitest, coverage, and mock dependencies
- Configure vitest for Electron main process testing
- Add global mocks for electron-store and node-pty
- Set 60% coverage threshold
```

## Next Steps

Proceed to [Phase 4: Write Core Module Tests](./phase-04-write-tests.md)
