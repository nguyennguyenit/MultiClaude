# Phase 5: Renderer UI Components

## Context

- Parent: [plan.md](./plan.md)
- Dependencies: [Phase 4](./phase-04-ipc-handlers-preload.md)
- Docs: [code-standards.md](../../docs/code-standards.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-08 |
| Priority | P1 |
| Effort | 4h |
| Status | pending |
| Review | pending |

Build SSH UI components: Quick Connect dropdown, Connection modal, terminal badges.

## Key Insights

- SSH terminals should look like local terminals with badge
- Quick Connect in tab bar for fast access
- Modal for detailed connection configuration
- Status indicator shows connection state

## Requirements

1. SSHQuickConnect dropdown in terminal tab bar
2. SSHConnectionModal for new/edit connection
3. SSH badge in terminal pane header
4. SSH status indicator (🟢🟡🔴)
5. SSH profile management in app-store

## Architecture

### File Structure

```
src/renderer/components/ssh/
├── index.ts
├── ssh-quick-connect.tsx     # Dropdown in tab bar
└── ssh-connection-modal.tsx  # New connection form
```

### UI Components

#### Quick Connect Dropdown
```
┌─────────────────────────────────────────────────────────────┐
│ [Terminal 1] [Terminal 2] [🔌 dev-server] [+] │ [🔗 SSH ▾] │
└─────────────────────────────────────────────────────────────┘
                                                      │
                                        ┌─────────────▼──────────────┐
                                        │ 📋 Recent:                 │
                                        │   🖥️ dev-server            │
                                        │   🖥️ prod-db               │
                                        │ ─────────────────────────  │
                                        │ 📂 From ~/.ssh/config:     │
                                        │   🖥️ github.com            │
                                        │   🖥️ myserver              │
                                        │ ─────────────────────────  │
                                        │ [+ New Connection...]      │
                                        └────────────────────────────┘
```

#### SSH Terminal Badge
```
┌──────────────────────────────────────────┐
│ 🔌 dev-server [●]  [Claude] [✕]          │  ← SSH badge + status
├──────────────────────────────────────────┤
│ user@server:~$                           │
└──────────────────────────────────────────┘

Status indicators:
🟢 Connected
🟡 Connecting / Reconnecting
🔴 Disconnected / Error
```

### App Store Extensions

```typescript
// app-store.ts additions
interface AppState {
  // ... existing
  sshProfiles: SSHProfile[]
  recentSSHConnections: string[] // profile IDs

  // Actions
  setSshProfiles: (profiles: SSHProfile[]) => void
  addRecentSSHConnection: (profileId: string) => void
}
```

## Related Code Files

| File | Action |
|------|--------|
| `src/renderer/components/ssh/index.ts` | Create |
| `src/renderer/components/ssh/ssh-quick-connect.tsx` | Create |
| `src/renderer/components/ssh/ssh-connection-modal.tsx` | Create |
| `src/renderer/components/terminal/terminal-pane.tsx` | Modify |
| `src/renderer/stores/app-store.ts` | Modify |
| `src/renderer/App.tsx` | Modify (add Quick Connect) |

## Implementation Steps

1. Add sshProfiles state to app-store
2. Create ssh-quick-connect.tsx dropdown
3. Create ssh-connection-modal.tsx form
4. Update terminal-pane.tsx with SSH badge
5. Add SSHQuickConnect to terminal tab bar area
6. Setup SSH profile loading on app mount
7. Add CSS for SSH components

## Todo List

- [ ] Add sshProfiles, recentSSHConnections to app-store
- [ ] Add setSshProfiles, addRecentSSHConnection actions
- [ ] Create ssh-quick-connect.tsx with dropdown UI
- [ ] Create ssh-connection-modal.tsx with form
- [ ] Add SSH badge to terminal-pane header
- [ ] Add status indicator component
- [ ] Integrate SSHQuickConnect in App.tsx
- [ ] Load SSH profiles on mount
- [ ] Add keyboard shortcut (optional: Ctrl+Shift+S)
- [ ] Style components with theme variables

## Success Criteria

- [ ] Quick Connect shows all profiles
- [ ] Click profile opens SSH terminal
- [ ] New Connection opens modal
- [ ] SSH terminals show badge
- [ ] Status indicator updates on connection state
- [ ] UI matches design spec

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Modal complexity | Medium | Keep form minimal for v1 |
| Theme consistency | Low | Use existing CSS variables |

## Security Considerations

- Never show passwords in UI
- Mask password input field
- Clear password from component state after use

## Next Steps

After completion, proceed to [Phase 6: Polish & Testing](./phase-06-polish-testing.md)
