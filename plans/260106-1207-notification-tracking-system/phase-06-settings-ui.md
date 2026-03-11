# Phase 6: Settings UI

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Depends On:** Phase 1 (Types), Phase 4 (Integration)

## Overview

- **Priority:** P2
- **Status:** Done (2026-01-07)
- **Description:** Add UI controls for new notification settings

## Key Insights

- Three new settings: outputMode, notifyOnlyBackground, includeTaskSummary
- Follow existing UI patterns in notification-settings.tsx
- Use existing ToggleRow component for boolean settings
- Use select dropdown for outputMode (like soundPreset)

## Requirements

- Output mode selector: Auto / Stream JSON / Plain Text
- Background-only toggle (default: on)
- Include task summary toggle (default: on)
- Maintain existing UI layout

## Related Code Files

**Modify:**
- `src/renderer/components/settings/notification-settings.tsx`
- `src/renderer/stores/notification-store.ts` (may need updates)

## Implementation Steps

### 1. Update `src/renderer/components/settings/notification-settings.tsx`

Add new section after Sound section:

```tsx
{/* Behavior Section */}
<div>
  <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Behavior</div>
  <div className="space-y-2">
    {/* Output Mode */}
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--mc-text-primary)]">Detection Mode</span>
      <select
        value={settings.outputMode}
        onChange={(e) => updateSettings({ outputMode: e.target.value as OutputMode })}
        className="text-xs bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
      >
        <option value="auto">Auto (Recommended)</option>
        <option value="stream-json">JSON Stream</option>
        <option value="plain-text">Plain Text</option>
      </select>
    </div>

    {/* Background Only */}
    <ToggleRow
      label="Only When Background"
      checked={settings.notifyOnlyBackground}
      onChange={(v) => updateSettings({ notifyOnlyBackground: v })}
    />
    <div className="text-[10px] text-[var(--mc-text-muted)] pl-2 -mt-1">
      Skip notifications when watching the terminal
    </div>

    {/* Include Task Summary */}
    <ToggleRow
      label="Include Project Name"
      checked={settings.includeTaskSummary}
      onChange={(v) => updateSettings({ includeTaskSummary: v })}
    />
  </div>
</div>
```

### 2. Add import for OutputMode

```tsx
import type { SoundPreset, OutputMode } from '@shared/types'
```

### 3. Full updated component structure

```tsx
export function NotificationSettings() {
  const { settings, loadSettings, updateSettings } = useNotificationStore()
  const [telegramModalOpen, setTelegramModalOpen] = useState(false)
  const [discordModalOpen, setDiscordModalOpen] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // ... existing handlers ...

  return (
    <div className="space-y-4">
      {/* Events Section */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Events</div>
        <div className="space-y-2">
          <ToggleRow
            label="On Task Complete"
            checked={settings.onTaskComplete}
            onChange={(v) => updateSettings({ onTaskComplete: v })}
          />
          <ToggleRow
            label="On Task Failed"
            checked={settings.onTaskFailed}
            onChange={(v) => updateSettings({ onTaskFailed: v })}
          />
          <ToggleRow
            label="On Review Needed"
            checked={settings.onReviewNeeded}
            onChange={(v) => updateSettings({ onReviewNeeded: v })}
          />
        </div>
      </div>

      {/* Behavior Section - NEW */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Behavior</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--mc-text-primary)]">Detection Mode</span>
            <select
              value={settings.outputMode}
              onChange={(e) => updateSettings({ outputMode: e.target.value as OutputMode })}
              className="text-xs bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
            >
              <option value="auto">Auto (Recommended)</option>
              <option value="stream-json">JSON Stream</option>
              <option value="plain-text">Plain Text</option>
            </select>
          </div>

          <ToggleRow
            label="Only When Background"
            checked={settings.notifyOnlyBackground}
            onChange={(v) => updateSettings({ notifyOnlyBackground: v })}
          />
          <div className="text-[10px] text-[var(--mc-text-muted)] pl-2 -mt-1">
            Skip notifications when watching the terminal
          </div>

          <ToggleRow
            label="Include Project Name"
            checked={settings.includeTaskSummary}
            onChange={(v) => updateSettings({ includeTaskSummary: v })}
          />
        </div>
      </div>

      {/* Sound Section */}
      <div>
        {/* ... existing sound settings ... */}
      </div>

      {/* External Section */}
      <div>
        {/* ... existing external settings ... */}
      </div>

      {/* Modals */}
      {/* ... existing modals ... */}
    </div>
  )
}
```

### 4. Update notification store if needed

Ensure `notification-store.ts` handles the new settings fields. The existing store should work since it uses `Partial<NotificationSettings>` for updates.

### 5. Add active terminal tracking

Add call to set active terminal when terminal tab changes. In App.tsx or TerminalGrid:

```tsx
// When active terminal changes
useEffect(() => {
  window.electron.notification.setActiveTerminal(activeTerminalId)
}, [activeTerminalId])
```

## Todo List

- [x] Add Behavior section to notification-settings.tsx
- [x] Add Detection Mode dropdown (auto/stream-json/plain-text)
- [x] Add "Only When Background" toggle with description
- [x] Add "Include Project Name" toggle
- [x] Import OutputMode type
- [x] Add setActiveTerminal() call in renderer
- [x] Test UI renders correctly with new settings
- [x] Test settings persist and sync with main process

## Success Criteria

- [x] New settings section appears in Notifications tab
- [x] Detection Mode dropdown shows three options
- [x] Toggle states persist after reload
- [x] Settings sync with main process NotificationManager
- [x] Active terminal ID syncs on tab change

## Risk Assessment

- **Low:** UI may need layout adjustments for smaller screens
- **Mitigation:** Use responsive design patterns

## Security Considerations

- None for this phase (UI only)

## Next Steps

After completing all phases:
- Write tests for new components
- Update documentation
- Manual testing across platforms
