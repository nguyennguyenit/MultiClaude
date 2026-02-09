# Phase 7: Testing & Polish

**Parent:** [plan.md](./plan.md)
**Dependencies:** Phase 1-6
**Blocks:** None

---

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-09 |
| Priority | P2 |
| Status | pending |
| Effort | 3.5h |

Add tests, improve accessibility, handle edge cases, and polish UX.

---

## Requirements

- [ ] Unit tests for modal components
- [ ] Integration tests for flows
- [ ] E2E tests with Playwright
- [ ] Keyboard accessibility
- [ ] Focus management
- [ ] Error recovery
- [ ] Edge case handling

---

## Testing Strategy

### Unit Tests (~1h)

**File:** `src/renderer/components/git-init-modal/__tests__/git-init-modal.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { GitInitModal } from '../git-init-modal'

describe('GitInitModal', () => {
  const defaultProps = {
    isOpen: true,
    folderPath: '/test/project',
    folderName: 'project',
    onClose: jest.fn(),
    onSkip: jest.fn(),
    onInitGit: jest.fn()
  }

  it('renders when open', () => {
    render(<GitInitModal {...defaultProps} />)
    expect(screen.getByText('Git Repository Required')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<GitInitModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Git Repository Required')).not.toBeInTheDocument()
  })

  it('calls onSkip with dontAskAgain when clicking Skip', () => {
    render(<GitInitModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Skip for now'))
    expect(defaultProps.onSkip).toHaveBeenCalledWith(false)
  })

  it('passes dontAskAgain=true when checkbox checked', () => {
    render(<GitInitModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('Skip for now'))
    expect(defaultProps.onSkip).toHaveBeenCalledWith(true)
  })

  it('shows loading state during init', async () => {
    const onInitGit = jest.fn(() => new Promise(r => setTimeout(r, 100)))
    render(<GitInitModal {...defaultProps} onInitGit={onInitGit} />)
    fireEvent.click(screen.getByText('Initialize Git'))
    expect(screen.getByText('Initializing...')).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    render(<GitInitModal {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})
```

**File:** `src/renderer/components/github-connection-modal/__tests__/github-connection-modal.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { GitHubConnectionModal } from '../github-connection-modal'

// Mock electron API
const mockGetAuthStatus = jest.fn()
beforeEach(() => {
  window.electron = {
    github: {
      getAuthStatus: mockGetAuthStatus
    }
  }
})

describe('GitHubConnectionModal', () => {
  const defaultProps = {
    isOpen: true,
    projectPath: '/test/project',
    projectName: 'project',
    onClose: jest.fn(),
    onSkip: jest.fn(),
    onComplete: jest.fn()
  }

  it('shows auth step when not authenticated', async () => {
    mockGetAuthStatus.mockResolvedValue({ isAuthenticated: false })
    render(<GitHubConnectionModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Login with GitHub')).toBeInTheDocument()
    })
  })

  it('skips to configure step when authenticated', async () => {
    mockGetAuthStatus.mockResolvedValue({ isAuthenticated: true, username: 'testuser' })
    render(<GitHubConnectionModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Create New Repo')).toBeInTheDocument()
    })
  })
})
```

### E2E Tests (~1.5h)

**File:** `e2e/git-onboarding.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Git Onboarding', () => {
  test('shows git init modal for folder without .git', async ({ page }) => {
    // Click add project
    await page.click('[data-testid="add-project-btn"]')

    // Select folder without git (use test fixtures)
    // Modal should appear
    await expect(page.locator('text=Git Repository Required')).toBeVisible()
  })

  test('initializes git and shows github modal', async ({ page }) => {
    // Navigate to git init modal
    await page.click('[data-testid="add-project-btn"]')
    // ...select folder

    // Click Initialize Git
    await page.click('text=Initialize Git')

    // Wait for GitHub modal
    await expect(page.locator('text=Connect to GitHub')).toBeVisible()
  })

  test('skips git init with dont ask again', async ({ page }) => {
    await page.click('[data-testid="add-project-btn"]')
    // ...select folder

    // Check checkbox
    await page.click('text=Don\'t ask again')
    await page.click('text=Skip for now')

    // Project should be added
    await expect(page.locator('[data-testid="project-item"]')).toBeVisible()

    // Re-add same folder - modal should NOT appear
    await page.click('[data-testid="add-project-btn"]')
    // ...select same folder
    await expect(page.locator('text=Git Repository Required')).not.toBeVisible()
  })

  test('push without remote triggers github modal', async ({ page }) => {
    // Add project with git but no remote
    // ...

    // Click push button
    await page.click('[data-testid="git-push-btn"]')

    // GitHub modal should appear
    await expect(page.locator('text=Connect to GitHub')).toBeVisible()
  })
})
```

### Accessibility Improvements (~30min)

1. **Focus Management:**
```tsx
// In modal component
const firstFocusable = useRef<HTMLButtonElement>(null)

useEffect(() => {
  if (isOpen) {
    firstFocusable.current?.focus()
  }
}, [isOpen])
```

2. **Aria Labels:**
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Git Repository Required</h2>
  ...
</div>
```

3. **Keyboard Navigation:**
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [onClose])
```

4. **Focus Trap:**
```tsx
// Use focus-trap-react or implement manually
<FocusTrap>
  <div className="modal-content">...</div>
</FocusTrap>
```

### Edge Case Handling (~30min)

1. **Folder deleted during modal:**
```typescript
const handleInitGit = async () => {
  // Re-check folder exists
  const check = await window.electron.project.checkFolder(folderPath)
  if (!check.exists) {
    addToast('Folder no longer exists', 'error')
    onClose()
    return
  }
  // ... continue
}
```

2. **Remote added externally:**
```typescript
// In GitHub modal - poll or check before actions
const handleCreate = async () => {
  const status = await window.electron.git.getStatus(projectPath)
  if (status.hasRemote) {
    addToast('Remote already exists', 'info')
    onComplete(false)
    return
  }
  // ... continue
}
```

3. **Network failure:**
```typescript
const validateRepoPath = async (value: string) => {
  try {
    const response = await fetch(`https://api.github.com/repos/${value}`)
    // ...
  } catch (error) {
    setValidationStatus('idle')
    addToast('Network error. Check connection.', 'warning')
  }
}
```

4. **gh CLI not installed:**
```typescript
const handleLogin = async () => {
  const result = await window.electron.github.login()
  if (result.error?.includes('not found')) {
    addToast('GitHub CLI not installed. Install from cli.github.com', 'error')
    return
  }
  // ...
}
```

---

## Todo List

- [ ] Create unit tests for GitInitModal
- [ ] Create unit tests for GitHubConnectionModal
- [ ] Create unit tests for configure-step
- [ ] Write E2E tests for full flows
- [ ] Add aria labels and roles
- [ ] Implement focus trap
- [ ] Add Escape key handler
- [ ] Add folder existence re-check
- [ ] Add remote existence check
- [ ] Handle network errors
- [ ] Handle gh CLI missing

---

## Success Criteria

- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Keyboard navigation works
- [ ] Screen reader announces modal
- [ ] Focus trapped in modal
- [ ] Escape closes modal
- [ ] Edge cases handled gracefully
- [ ] Error messages are helpful

---

## Notes

- Use @testing-library/react for unit tests
- Playwright for E2E (already configured)
- Focus on happy path first, then edge cases
- Keep tests focused and fast
