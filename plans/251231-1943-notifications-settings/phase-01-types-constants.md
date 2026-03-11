# Phase 1: Types & Constants

## Overview

- **Priority**: P1 (Foundation)
- **Status**: Completed
- **Effort**: 1h

Define TypeScript types and IPC channel constants for notification system.

## Related Files

- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/constants/ipc-channels.ts`
- Create: `src/shared/types/notification.ts`
- Create: `src/shared/constants/notification.ts`

## Implementation Steps

### Step 1: Create notification types

**File**: `src/shared/types/notification.ts`

```typescript
// Notification event types
export type NotificationEventType = 'taskComplete' | 'taskFailed' | 'reviewNeeded'

// Sound preset options
export type SoundPreset = 'default' | 'minimal' | 'retro'

// Main settings interface (stored in localStorage via Zustand)
export interface NotificationSettings {
  // Event toggles
  onTaskComplete: boolean
  onTaskFailed: boolean
  onReviewNeeded: boolean

  // Sound
  soundEnabled: boolean
  soundPreset: SoundPreset

  // Telegram (credentials stored securely via IPC)
  telegramEnabled: boolean
  telegramConfigured: boolean

  // Discord (credentials stored securely via IPC)
  discordEnabled: boolean
  discordConfigured: boolean
}

// Telegram credentials (never stored in renderer)
export interface TelegramCredentials {
  botToken: string
  chatId: string
}

// Discord credentials (never stored in renderer)
export interface DiscordCredentials {
  webhookUrl: string
}

// Notification event payload
export interface NotificationEvent {
  type: NotificationEventType
  terminalId: string
  message: string
  timestamp: number
}

// Test result for external platforms
export interface NotificationTestResult {
  success: boolean
  error?: string
}
```

### Step 2: Create notification constants

**File**: `src/shared/constants/notification.ts`

```typescript
import type { NotificationSettings, SoundPreset } from '../types/notification'

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  onTaskComplete: true,
  onTaskFailed: true,
  onReviewNeeded: true,
  soundEnabled: true,
  soundPreset: 'default',
  telegramEnabled: false,
  telegramConfigured: false,
  discordEnabled: false,
  discordConfigured: false
}

// Sound preset definitions
export const SOUND_PRESETS: { id: SoundPreset; name: string; description: string }[] = [
  { id: 'default', name: 'Default', description: 'Standard notification sounds' },
  { id: 'minimal', name: 'Minimal', description: 'Subtle, soft tones' },
  { id: 'retro', name: 'Retro', description: '8-bit style sounds' }
]

// Pattern detection (placeholder - update after research)
export const DETECTION_PATTERNS = {
  taskComplete: /✓.*completed|Task completed|Done!|finished successfully/i,
  taskFailed: /✗.*failed|Error:|Task failed|FAILED/i,
  reviewNeeded: /review needed|waiting for review|needs review|please review/i
}
```

### Step 3: Add IPC channels

**File**: `src/shared/constants/ipc-channels.ts`

Add to existing `IPC_CHANNELS` object:

```typescript
// Notification channels
NOTIFICATION_GET_SETTINGS: 'notification:get-settings',
NOTIFICATION_SET_SETTINGS: 'notification:set-settings',
NOTIFICATION_SET_TELEGRAM: 'notification:set-telegram',
NOTIFICATION_SET_DISCORD: 'notification:set-discord',
NOTIFICATION_GET_TELEGRAM_STATUS: 'notification:get-telegram-status',
NOTIFICATION_GET_DISCORD_STATUS: 'notification:get-discord-status',
NOTIFICATION_TEST_TELEGRAM: 'notification:test-telegram',
NOTIFICATION_TEST_DISCORD: 'notification:test-discord',
NOTIFICATION_CLEAR_TELEGRAM: 'notification:clear-telegram',
NOTIFICATION_CLEAR_DISCORD: 'notification:clear-discord',
NOTIFICATION_EVENT: 'notification:event',  // main → renderer
```

### Step 4: Export types

**File**: `src/shared/types/index.ts`

Add at end:

```typescript
// Notification types
export * from './notification'
```

### Step 5: Export constants

**File**: `src/shared/constants/index.ts`

Add:

```typescript
export * from './notification'
```

## Todo List

- [x] Create `src/shared/types/notification.ts`
- [x] Create `src/shared/constants/notification.ts`
- [x] Update `src/shared/constants/ipc-channels.ts`
- [x] Update `src/shared/types/index.ts`
- [x] Update `src/shared/constants/index.ts`
- [x] Verify TypeScript compilation

## Success Criteria

- All types properly defined
- IPC channels added to constant
- Exports working
- No TypeScript errors

## Next Steps

→ Proceed to [Phase 2: Main Process](./phase-02-main-process.md)
