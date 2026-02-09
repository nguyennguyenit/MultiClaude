# Notifications Feature - Brainstorm Summary

**Date:** 2025-12-31
**Status:** Ready for Implementation Planning

---

## Problem Statement

User cần tính năng Notifications trong Settings menu với:
- 3 event types: Task Complete, Task Failed, Review Needed
- Sound notifications với multiple presets
- External notifications qua Telegram và Discord (both simultaneously)
- Toggle switches cho từng option

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                          │
├─────────────────────────────────────────────────────────────────┤
│  SettingsPanel                                                   │
│  └── NotificationSettings (new component)                        │
│      ├── Event Toggles (Task Complete/Failed/Review Needed)      │
│      ├── Sound Settings (enable + preset selector)               │
│      ├── Telegram Config Button → Modal                          │
│      └── Discord Config Button → Modal                           │
├─────────────────────────────────────────────────────────────────┤
│  notification-settings-store.ts (Zustand)                        │
│  └── Manages UI state + calls IPC for secure storage             │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS                             │
├─────────────────────────────────────────────────────────────────┤
│  notification/                                                   │
│  ├── notification-manager.ts   # Core logic                      │
│  ├── pattern-detector.ts       # Parse terminal output           │
│  ├── telegram-notifier.ts      # Telegram Bot API                │
│  ├── discord-notifier.ts       # Discord Webhook                 │
│  └── sound-player.ts           # Play preset sounds              │
├─────────────────────────────────────────────────────────────────┤
│  Electron safeStorage (built-in)                                 │
│  └── Store Telegram Token + Discord Webhook URL                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Decisions

### 1. Secure Storage: Electron safeStorage (Recommended)

**Tại sao không dùng keytar:**
- keytar cần native compilation, phức tạp cross-platform
- Electron đã có `safeStorage` built-in từ v15+
- Không cần thêm dependency

**Implementation:**
```typescript
// main process
import { safeStorage } from 'electron'

const encryptedToken = safeStorage.encryptString(token)
// Store encrypted buffer in electron-store
```

**Sources:**
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Replacing Keytar with safeStorage](https://freek.dev/2103-replacing-keytar-with-electrons-safestorage-in-ray)

### 2. Event Detection: Terminal Output Pattern Matching

**Approach:**
- Hook vào node-pty output stream trong `terminal-manager.ts`
- Regex patterns để detect events (configurable later)
- Default patterns có thể update sau khi research Claude Code output

**Initial patterns (placeholder):**
```typescript
const PATTERNS = {
  taskComplete: /✓.*completed|Task completed|Done!/i,
  taskFailed: /✗.*failed|Error:|Task failed/i,
  reviewNeeded: /review needed|waiting for review|needs review/i
}
```

### 3. External Notifications

**Telegram:** Simple HTTP POST (no library needed)
```typescript
// Direct fetch - no dependency
fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text: message })
})
```

**Discord:** Direct webhook POST
```typescript
fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: message })
})
```

**Sources:**
- [Telegram Bot API](https://github.com/yagop/node-telegram-bot-api)
- [Discord Webhook Node](https://github.com/matthew1232/discord-webhook-node)

### 4. Sound Notifications

**Presets:**
- `success.mp3` - Task complete
- `error.mp3` - Task failed
- `info.mp3` - Review needed

**Location:** `src/renderer/assets/sounds/`

**Implementation:** HTML5 Audio API (works in Electron renderer)

---

## Data Model

```typescript
// src/shared/types/index.ts

interface NotificationSettings {
  // Event toggles
  onTaskComplete: boolean
  onTaskFailed: boolean
  onReviewNeeded: boolean

  // Sound
  soundEnabled: boolean
  soundPreset: 'default' | 'minimal' | 'retro'

  // Telegram
  telegramEnabled: boolean
  telegramConfigured: boolean  // has token + chatId

  // Discord
  discordEnabled: boolean
  discordConfigured: boolean  // has webhook URL
}

// Stored securely via IPC (never in localStorage)
interface SecureCredentials {
  telegramBotToken?: string
  telegramChatId?: string
  discordWebhookUrl?: string
}
```

---

## UI Components

### NotificationSettings Component

```
┌─────────────────────────────────────────────────────┐
│ Notifications                                    [X]│
├─────────────────────────────────────────────────────┤
│                                                     │
│ Events                                              │
│ ┌─────────────────────────────────────────────────┐│
│ │ On Task Complete               [━━━━━━━━●]      ││
│ │ On Task Failed                 [●━━━━━━━━]      ││
│ │ On Review Needed               [━━━━━━━━●]      ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ Sound                                               │
│ ┌─────────────────────────────────────────────────┐│
│ │ Enable Sound                   [━━━━━━━━●]      ││
│ │ Preset        [▼ Default        ]               ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ External Notifications                              │
│ ┌─────────────────────────────────────────────────┐│
│ │ 📱 Telegram   [━━●]   [Configure]               ││
│ │ 💬 Discord    [━━●]   [Configure]               ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Config Modals

**Telegram Modal:**
- Bot Token input (password field)
- Chat ID input
- "Test" button
- Instructions link to BotFather

**Discord Modal:**
- Webhook URL input (password field)
- "Test" button
- Instructions link to Discord docs

---

## File Structure

```
src/
├── main/
│   └── notification/
│       ├── index.ts
│       ├── notification-manager.ts
│       ├── pattern-detector.ts
│       ├── telegram-notifier.ts
│       ├── discord-notifier.ts
│       ├── sound-player.ts
│       └── secure-storage.ts
├── renderer/
│   ├── components/
│   │   └── settings/
│   │       ├── notification-settings.tsx
│   │       ├── telegram-config-modal.tsx
│   │       └── discord-config-modal.tsx
│   ├── stores/
│   │   └── notification-store.ts
│   └── assets/
│       └── sounds/
│           ├── success-default.mp3
│           ├── error-default.mp3
│           ├── info-default.mp3
│           └── ... (other presets)
├── shared/
│   ├── types/
│   │   └── notification.ts
│   └── constants/
│       └── ipc-channels.ts (add notification channels)
└── preload/
    └── index.ts (expose notification IPC)
```

---

## IPC Channels

```typescript
// Add to ipc-channels.ts
export const NOTIFICATION_CHANNELS = {
  // Settings
  GET_NOTIFICATION_SETTINGS: 'notification:get-settings',
  SET_NOTIFICATION_SETTINGS: 'notification:set-settings',

  // Secure credentials
  SET_TELEGRAM_CREDENTIALS: 'notification:set-telegram',
  SET_DISCORD_WEBHOOK: 'notification:set-discord',
  TEST_TELEGRAM: 'notification:test-telegram',
  TEST_DISCORD: 'notification:test-discord',

  // Events (main → renderer)
  NOTIFICATION_TRIGGERED: 'notification:triggered'
}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude Code output patterns unknown | Pattern detection fails | Make patterns configurable; start with common patterns |
| Rate limiting (Telegram/Discord) | Messages dropped | Queue + debounce notifications |
| safeStorage unavailable on some Linux | Credentials unprotected | Fallback to electron-store encryption |
| Sound playback blocks UI | Poor UX | Use Web Audio API with async loading |

---

## Implementation Considerations

1. **Pattern Detection Phase:**
   - Start với placeholder patterns
   - Log terminal output để research real patterns
   - Consider adding "Custom Pattern" option later

2. **Testing Strategy:**
   - Manual test buttons for Telegram/Discord
   - Mock terminal events for pattern testing
   - Verify sound plays correctly on all platforms

3. **Future Enhancements:**
   - Custom sound upload
   - Message templates với variables
   - Notification history/log
   - Per-project notification settings

---

## Dependencies

**No new npm packages required!**
- Use Electron safeStorage (built-in)
- Use fetch API for Telegram/Discord
- Use HTML5 Audio for sounds

Only need to add sound files (mp3/wav).

---

## Next Steps

1. Create implementation plan với detailed steps
2. Research Claude Code output patterns
3. Source/create sound files

---

## Unresolved Questions

1. **Pattern accuracy:** Cần chạy Claude Code và capture output để xác định patterns chính xác
2. **Sound licensing:** Cần tìm royalty-free sounds hoặc tạo mới
3. **Linux sound support:** HTML5 Audio có thể cần fallback trên một số distros

---

## Sources

- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Replacing Keytar with safeStorage](https://freek.dev/2103-replacing-keytar-with-electrons-safestorage-in-ray)
- [Telegram Bot API - node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Discord Webhook Node](https://github.com/matthew1232/discord-webhook-node)
- [npm: discord-webhook-node](https://www.npmjs.com/package/discord-webhook-node)
