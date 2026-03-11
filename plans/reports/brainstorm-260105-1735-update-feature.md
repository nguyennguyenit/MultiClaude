# Brainstorm: Update Feature for MultiClaude

**Date:** 2026-01-05
**Status:** Complete
**Reporter:** Solution Brainstormer

---

## Problem Statement

Current auto-update implementation uses native OS dialogs for update prompts. Need improved UX with:
- In-app UI showing update status/progress
- Changelog display from GitHub Releases
- Manual "Check for Updates" button
- Silent badge notification when update available

## Requirements Summary

| Aspect | Decision |
|--------|----------|
| Changelog source | GitHub Releases API |
| UI location | New tab in Settings panel |
| Notification | Silent badge on Settings button |
| Info level | Minimal (version, check button, update info) |

---

## Evaluated Approaches

### Approach 1: Lightweight Settings Tab Integration (Recommended)

**Architecture:**
```
Main Process (src/main/):
├── updater/auto-updater.ts
│   ├── Add: fetchReleaseNotes(version: string)
│   ├── Add: getUpdateState() → UpdateState
│   ├── Enhance: IPC events for all lifecycle
│   └── Cache: Store update state in memory
│
Renderer (src/renderer/):
├── stores/update-store.ts (new)
│   ├── updateAvailable: boolean
│   ├── latestVersion: string | null
│   ├── releaseNotes: string | null
│   ├── downloadProgress: number
│   ├── updateStatus: 'idle' | 'checking' | 'available' | 'downloading' | 'ready'
│   └── Actions: checkForUpdates, downloadUpdate, installUpdate
│
├── components/settings/update-settings.tsx (new)
│   ├── Current version display
│   ├── "Check for Updates" button
│   ├── Update status/progress
│   └── Changelog with markdown rendering
│
├── components/settings/settings-sidebar.tsx
│   └── Add 'updates' tab with conditional badge
│
└── components/sidebar/sidebar.tsx
    └── Add badge dot on Settings button when update available
```

**Pros:**
- Minimal changes, leverages existing electron-updater
- Follows existing UI patterns (settings tabs)
- GitHub API requires no auth for public repos
- Simple badge implementation

**Cons:**
- GitHub API rate limit: 60 req/hr (acceptable for manual checks)
- Need markdown renderer for release notes

### Approach 2: Dedicated Update Modal

Separate modal triggered by clicking badge, shows full update info.

**Pros:**
- More prominent presentation
- Dedicated UX focus

**Cons:**
- Extra modal adds complexity
- Conflicts with user's preference for Settings panel

### Approach 3: Status Bar / Banner

Persistent element showing update status.

**Pros:**
- Always visible
- Quick action access

**Cons:**
- Takes up screen real estate
- User chose silent badge approach

---

## Recommended Solution

**Approach 1: Lightweight Settings Tab Integration**

Rationale:
- Aligns with user preferences (Settings panel, minimal info, silent badge)
- KISS principle: reuses existing patterns
- Low risk: electron-updater already works, just adding UI layer

---

## Implementation Details

### 1. IPC Channels (add to `src/shared/constants/ipc-channels.ts`)

```typescript
// Update channels
UPDATE_GET_STATE: 'update:get-state',
UPDATE_CHECK: 'update:check',
UPDATE_DOWNLOAD: 'update:download',
UPDATE_INSTALL: 'update:install',
UPDATE_GET_RELEASE_NOTES: 'update:get-release-notes',
```

### 2. Update State Type (add to `src/shared/types/`)

```typescript
interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  downloadProgress: number // 0-100
  error: string | null
}
```

### 3. Main Process Enhancements

**GitHub Release Notes Fetch:**
```typescript
async function fetchReleaseNotes(version: string): Promise<string> {
  const url = `https://api.github.com/repos/nguyennguyenit/MultiClaude/releases/tags/v${version}`
  const res = await fetch(url)
  const data = await res.json()
  return data.body || 'No release notes available.'
}
```

### 4. Settings Tab UI

```
┌─────────────────────────────────────┐
│ Updates                             │
├─────────────────────────────────────┤
│                                     │
│ Current Version: 1.1.2              │
│                                     │
│ [Check for Updates]                 │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ (When update available:)            │
│ ✓ Version 1.2.0 available           │
│                                     │
│ ## What's New                       │
│ - Feature A                         │
│ - Bug fix B                         │
│                                     │
│ [Download Update]                   │
│                                     │
│ (When downloading:)                 │
│ Downloading... 45%                  │
│ ████████░░░░░░░░░░░░                │
│                                     │
│ (When ready:)                       │
│ [Install and Restart]               │
│                                     │
└─────────────────────────────────────┘
```

### 5. Badge Implementation

**Settings button in sidebar:**
```tsx
// In sidebar.tsx
{updateAvailable && (
  <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
)}
```

**Settings sidebar tab:**
```tsx
// In settings-sidebar.tsx
{ id: 'updates', label: 'Updates', icon: '↻', badge: updateAvailable }
```

---

## Technical Considerations

### GitHub API Rate Limits
- Unauthenticated: 60 requests/hour
- Mitigation: Cache results, only fetch on manual check or when update detected
- electron-updater already handles version comparison, only fetch notes when needed

### Markdown Rendering
Options:
1. **Simple regex** - strip markdown, show plain text (KISS)
2. **react-markdown** - proper rendering (adds ~40KB)
3. **dangerouslySetInnerHTML** with marked - lightweight (~24KB)

Recommendation: Start with simple text, add markdown later if needed.

### Error Handling
- Network failures: Show "Check failed, try again"
- GitHub API errors: Graceful degradation, show update without notes
- Download failures: Allow retry

---

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/constants/ipc-channels.ts` | Modify | Add update channels |
| `src/shared/types/update.ts` | Create | UpdateState interface |
| `src/main/updater/auto-updater.ts` | Modify | Enhance with state management, release notes |
| `src/main/ipc/handlers.ts` | Modify | Add update IPC handlers |
| `src/preload/index.ts` | Modify | Expose update APIs |
| `src/renderer/stores/update-store.ts` | Create | Zustand store for update state |
| `src/renderer/components/settings/update-settings.tsx` | Create | Updates tab UI |
| `src/renderer/components/settings/settings-sidebar.tsx` | Modify | Add updates tab |
| `src/renderer/components/settings/settings-panel.tsx` | Modify | Render updates tab |
| `src/renderer/components/sidebar/sidebar.tsx` | Modify | Add badge to Settings button |

---

## Success Metrics

- [ ] Badge appears on Settings button when update available
- [ ] "Check for Updates" button triggers check and shows result
- [ ] Changelog displays from GitHub Releases
- [ ] Download progress shown in UI
- [ ] "Install and Restart" works correctly
- [ ] No regression in existing auto-update functionality

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub API rate limit | Low | Cache, minimal requests |
| electron-updater version mismatch | Medium | Test thoroughly |
| Badge not visible enough | Low | Adjust styling, use accent color |

---

## Next Steps

1. Create implementation plan with detailed steps
2. Implement main process enhancements
3. Create update store
4. Build update settings UI
5. Add badge to sidebar
6. Test full update flow

---

## Unresolved Questions

None - all requirements clarified during brainstorm.
