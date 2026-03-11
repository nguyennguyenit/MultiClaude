# Code Review: Phase 1 UI Testing Setup

**Date:** 2026-01-07
**Reviewer:** code-reviewer
**Score:** 8/10

## Scope

- Files reviewed: 6
- Lines analyzed: ~200
- Focus: Phase 1 - Playwright E2E testing setup

| File | Status |
|------|--------|
| `src/__tests__/e2e/playwright.config.ts` | OK |
| `src/__tests__/e2e/fixtures/electron-app.ts` | OK |
| `src/__tests__/e2e/fixtures/test-data.ts` | Warnings |
| `src/__tests__/e2e/fixtures/index.ts` | OK |
| `src/__tests__/e2e/tests/smoke.spec.ts` | OK |
| `package.json` | OK |

## Overall Assessment

Solid Phase 1 implementation. Clean fixture pattern, proper Electron app lifecycle management, reasonable config defaults. Main concerns: type mismatch between mock data and actual types, missing gitignore entries for test artifacts.

---

## Critical Issues (MUST FIX)

None.

---

## High Priority (SHOULD FIX)

### 1. Type Mismatch: Mock vs Actual Types

**File:** `src/__tests__/e2e/fixtures/test-data.ts`

MockProject/MockTerminal use `string` for dates, actual types use `Date`:

```typescript
// Mock (test-data.ts)
export interface MockProject {
  createdAt: string  // <-- string
  updatedAt: string
}

// Actual (shared/types/index.ts)
export interface Project {
  createdAt: Date    // <-- Date
  updatedAt: Date
}
```

**Impact:** When injecting mock data via localStorage, the app may fail to deserialize dates correctly or cause type errors at runtime.

**Fix:** Either:
- A) Change mock to use `Date` and serialize in `injectMockProject`
- B) Import actual types and extend/omit for test-specific fields
- C) Document serialization behavior explicitly

### 2. Missing Gitignore Entries

Test artifacts not gitignored:
- `src/__tests__/e2e/test-artifacts/`
- `src/__tests__/e2e/test-results/`
- `src/__tests__/e2e/screenshots/` (unless baseline screenshots intentional)

**Fix:** Add to `.gitignore`:
```
src/__tests__/e2e/test-artifacts/
src/__tests__/e2e/test-results/
```

---

## Medium Priority (NICE TO HAVE)

### 3. Hardcoded waitForTimeout

**File:** `src/__tests__/e2e/fixtures/electron-app.ts:33`

```typescript
await window.waitForTimeout(500)
```

Magic number, could cause flaky tests. Consider:
- Use `waitForSelector` for specific React component
- Extract to config constant with documentation

### 4. Weak Typing in injectMockProject

**File:** `src/__tests__/e2e/fixtures/electron-app.ts:54`

```typescript
export async function injectMockProject(window: Page, projects: unknown[]): Promise<void>
```

Using `unknown[]` loses type safety. Consider:
```typescript
import { MockProject } from './test-data'
export async function injectMockProject(window: Page, projects: MockProject[]): Promise<void>
```

### 5. Screenshots Directory Hardcoded

**File:** `src/__tests__/e2e/fixtures/electron-app.ts:75`

```typescript
path: `./src/__tests__/e2e/screenshots/${name}.png`
```

Consider using path relative to config or test directory.

---

## Low Priority (SUGGESTIONS)

- Add ESLint config for e2e tests (optional: may want different rules)
- Consider adding `test:ui:debug` script with `--debug` flag
- Document required build step before running e2e tests

---

## Positive Observations

- Clean fixture pattern using `base.extend`
- Proper app cleanup in fixture lifecycle
- Sequential test execution (correct for Electron)
- Good separation: config / fixtures / tests / data
- Reasonable defaults: 30s timeout, 1 retry, trace on retry
- NPM scripts cover common use cases (run, update, headed)

---

## Metrics

| Metric | Value |
|--------|-------|
| TypeScript | Compiles cleanly |
| Any usage | None detected |
| Security | No credentials, safe test env |
| YAGNI/KISS | Minimal code, no over-engineering |

---

## Unresolved Questions

1. Should baseline screenshots be committed or regenerated? (Affects gitignore decision)
2. Should MockProject/MockTerminal align exactly with actual types or remain test-specific?
