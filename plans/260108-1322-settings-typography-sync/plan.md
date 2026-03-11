---
title: Settings Typography Synchronization
status: done
created: 2026-01-08
completed: 2026-01-08T14:36:00
branch: beta
complexity: low
estimated_files: 7
---

# Settings Typography Synchronization

## Overview

Synchronize fonts and presentation across all Settings components by creating shared typography components (DRY principle).

## Problem Summary

| Issue | Files Affected |
|-------|----------------|
| Header font weight inconsistent (`font-semibold` vs `font-medium`) | 4 files |
| Sub-section label styling varies (4 different approaches) | All 6 tabs |
| Missing main header in `notification-settings.tsx` | 1 file |
| Divider margin inconsistent (`my-4` vs none) | 4 files |

## Solution

Create `settings-typography.tsx` with 3 shared components, then refactor all settings files to use them.

### Components Specification

```tsx
// src/renderer/components/settings/settings-typography.tsx

interface SettingsTitleProps {
  children: React.ReactNode
  description?: string
}

export function SettingsTitle({ children, description }: SettingsTitleProps) {
  return (
    <div>
      <h3 className="text-lg font-medium text-[var(--mc-text-primary)]">{children}</h3>
      {description && (
        <p className="text-sm text-[var(--mc-text-muted)]">{description}</p>
      )}
      <hr className="my-4 border-[var(--mc-border)]" />
    </div>
  )
}

export function SettingsSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase text-[var(--mc-text-muted)] mb-2 tracking-wide">
      {children}
    </h4>
  )
}

export function SettingsDivider() {
  return <hr className="my-4 border-[var(--mc-border)]" />
}
```

## Implementation Tasks

### Phase 1: Create Shared Component

| # | Task | File |
|---|------|------|
| 1.1 | Create `settings-typography.tsx` | `src/renderer/components/settings/settings-typography.tsx` |
| 1.2 | Export from barrel file | `src/renderer/components/settings/index.ts` |

### Phase 2: Refactor Settings Tabs

| # | Task | Current State | Change |
|---|------|---------------|--------|
| 2.1 | Update `theme-selector.tsx` | `h3.text-lg.font-medium` + inline h4 | Use `SettingsTitle`, `SettingsSubheading` |
| 2.2 | Update `terminal-settings.tsx` | Has local `SettingsSection` component | Remove local, use shared |
| 2.3 | Update `notification-settings.tsx` | No main header, `div.text-xs.uppercase` | Add `SettingsTitle`, use `SettingsSubheading` |
| 2.4 | Update `update-settings.tsx` | `font-semibold`, `span.text-xs.uppercase.tracking-wider` | Change to `font-medium`, use shared |

### Phase 3: Cleanup (Optional)

| # | Task |
|---|------|
| 3.1 | Remove local `SettingsSection` from `terminal-settings.tsx` (after confirming works) |
| 3.2 | Verify visual consistency across all tabs |

## File Change Summary

| File | Action | LOC Delta |
|------|--------|-----------|
| `settings-typography.tsx` | CREATE | +30 |
| `index.ts` | EDIT | +1 |
| `theme-selector.tsx` | EDIT | ~0 |
| `terminal-settings.tsx` | EDIT | -10 |
| `notification-settings.tsx` | EDIT | +5 |
| `update-settings.tsx` | EDIT | ~0 |

## Code Snippets

### Before/After: theme-selector.tsx

**Before:**
```tsx
<h3 className="text-lg font-medium">Appearance</h3>
<p className="text-sm text-[var(--mc-text-muted)]">...</p>
<hr className="my-4 border-[var(--mc-border)]" />
```

**After:**
```tsx
import { SettingsTitle, SettingsSubheading } from './settings-typography'
// ...
<SettingsTitle description="Customize how MultiClaude looks">
  Appearance
</SettingsTitle>
```

### Before/After: notification-settings.tsx

**Before:**
```tsx
<div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Events</div>
```

**After:**
```tsx
import { SettingsTitle, SettingsSubheading } from './settings-typography'
// ...
<SettingsTitle description="Configure notification triggers and channels">
  Notifications
</SettingsTitle>
<SettingsSubheading>Events</SettingsSubheading>
```

### Before/After: update-settings.tsx

**Before:**
```tsx
<h3 className="text-lg font-semibold text-[var(--mc-text-primary)]">Updates</h3>
<span className="text-xs font-semibold text-[var(--mc-text-muted)] uppercase tracking-wider">
  Version
</span>
```

**After:**
```tsx
<SettingsTitle description="Manage MultiClaude updates">Updates</SettingsTitle>
<SettingsSubheading>Version</SettingsSubheading>
```

## Validation Checklist

- [x] All 4 settings tabs render correctly
- [x] Typography is visually consistent across tabs
- [x] No console errors
- [x] Build passes
- [x] E2E settings tests pass (140/140 tests passing)

## Notes

- Config modals (`telegram-config-modal.tsx`, `discord-config-modal.tsx`) use different hierarchy (modal dialogs) - keep separate styling
- `settings-panel.tsx` is alternative compact view - evaluate if needs same treatment (future scope)
