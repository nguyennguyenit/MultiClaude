# Phase 01 — Telegram Inline Buttons + QR Deep-Link Pairing Shipped

**Date**: 2026-04-17 06:30  
**Severity**: Medium  
**Component**: Telegram notification system, pairing state machine, callback routing, pending-question storage  
**Status**: Resolved (shipped to master via 5 commits: 329b9a2, 8662a71, 156ce44, 67d1fba, 459e896)

## What Happened

Closed two UX gaps in Telegram integration. (1) `AskUserQuestion` payloads with `options[]` are now preserved end-to-end from Claude JSONL → `TaskEvent` → Telegram notification, rendered as inline option buttons. Tap a button → the option's label writes to PTY via existing `terminalManager.write()`. (2) Pairing flow moved from manual `chat_id` lookup (via @userinfobot) to QR deep-link: user scans → `/start mc-pair-<nonce>` auto-registers chatId. Mandatory nonce prevents hijacking; 60 s window + 5 s post-success warning for rogue double-pair attempts.

Phase 01 ships standalone. TDD discipline: 8 new test files, tests-first for every subtask. 755/755 tests pass. Typecheck clean. Lint clean.

## Technical Details

**AskUserQuestion Preservation:**  
Previously `json-stream-parser.ts:58-62` discarded `header`, `multiSelect`, `options[]` during extraction. Extended `TaskEvent` type with optional `question: { text, header?, multiSelect, options[] }` field. `json-stream-parser` now preserves the entire question shape. `telegram-notifier` builds inline-keyboard rows (≤3 buttons per row, ≤8 rows, 24-option cap) from `options[]`. Callback data: `answer:<index>:<questionId>:<terminalId>` embeds a 6-hex `questionId` for idempotency.

**Question Idempotency + PTY Bug Fix (M3):**  
During code review, spotted race: two `AskUserQuestion`s back-to-back on same terminal before user taps first. `pending-question-store.put()` silently overwrote the first; user's tap on index 0 of the OLD notification would write the NEW question's `options[0].label` to PTY. Fix: `put()` now returns a 6-hex `questionId` embedded in callback_data. `getByQuestionId()` rejects stale taps with "expired" reply. Regression test covers it.

**Multi-Select Visual Feedback (M1 Fix):**  
Toggle flipped the Set in memory but the Telegram keyboard never redrew — user saw no feedback on phone. `sendTaskEvent` now captures `message_id` via new `sendMessageRaw()` return value and stores it on the pending-question entry. Command router exposes `onToggleEdit` hook; `NotificationManager.startRemoteControl` wires it to `notifier.editReplyMarkup()` with a freshly-rebuilt keyboard reflecting the current `selected` Set. ⚪ → 🔘 live on tap.

**QR Pairing State Machine:**  
`TelegramAuthFlow` manages pairing lifecycle: `idle` → `waiting` → `completed|cancelled|timedOut`. Generates 64-bit crypto-random nonce per attempt (single-use). Renderer shows QR via `qrcode` package. On user's `/start mc-pair-<nonce>`, poller hook (inside existing `message` handler) intercepts BEFORE strict-chatId filter. Matches nonce → `completePairing(chatId)` → `secure-storage.setTelegram()` persists. Closes window on success, timeout, or cancel. 5 s post-success listening; second matching nonce with different chatId → "multiple devices tried pairing" warning.

**Callback Idempotency + Rate Limit:**  
Added LRU cache (200 entries) by `callback_query.id`. Duplicate delivery → `answerCallbackQuery` only, no side-effect. Global token-bucket rate limiter: 10 req/s. Both are process-global singletons with `reset()` for test isolation. Protects PTY write path against compromised Telegram account flooding.

**Bot Token Validation (L2 Fix):**  
`startTelegramPairing` embedded bot token directly in URL. Added regex guard: `/^\d+:[A-Za-z0-9_-]{35,}$/` before fetching Bot API getMe.

**IPC Surface:**  
`TELEGRAM_START_PAIRING`, `TELEGRAM_CANCEL_PAIRING`, `TELEGRAM_PAIRING_STATUS` commands. Event channels: `TELEGRAM_PAIRING_WAITING`, `TELEGRAM_PAIRED`, `TELEGRAM_PAIRING_TIMEOUT`, `TELEGRAM_PAIRING_WARNING`.

## The Brutal Truth

Code review caught 3 bugs that would have shipped undetected. The question-overwrite race (M3) is a real PTY corruption bug: user's tap would write the wrong label to the terminal, silently. The toggle-feedback gap (M1) is a UX trust killer — user flips the button, sees nothing happen, assumes it broke. The bot-token validation (L2) is a classic injection vector. TDD passed because unit tests exercise happy paths; integration review found the edge cases that unit tests can't surface without adversarial thinking. We knew this lesson from the pane-tree hardening but it didn't stick. Same pattern: "tests green, code ships, integration review catches the race."

The M3 fix required rethinking the callback_data payload architecture mid-implementation. That burn forced the right decision (embed questionId, not just rely on terminal+index), but it stung because the design was "complete" before review. Lesson: callback idempotency and question identity should have been baked into the design *before* implementation started, not bolted on after the fact.

## Numbers

- 5 commits on master (329b9a2 → 459e896).
- 755 tests passing (included 8 new test files + updates to 3 legacy router tests for new callback_data shape).
- Files created: `pending-question-store.ts`, `callback-idempotency.ts`, `callback-rate-limiter.ts`, `telegram-auth-flow.ts` + 6 test files.
- Files modified: 9 (json-stream-parser, telegram-notifier, telegram-command-router, telegram-poller, notification-manager, telegram-config-modal, ipc-channels, handlers, preload).
- `npx tsc --noEmit` clean. `npm run lint` clean.
- New dep: `qrcode ^1.5.4` (runtime) + `@types/qrcode` (dev).

## Root Cause Analysis

1. **Question-overwrite race invisible in isolation.** Unit tests drive happy path (one question, one tap). The race requires timing: two questions back-to-back, user's tap arrives after second question overwrites the store. Integration test caught it.

2. **Toggle feedback requires cross-layer wiring.** Unit tests verify the toggle flips the Set; they don't verify that the flip propagates to Telegram's rendered keyboard. Only manual testing or integration test covering "tap toggle → check message edit" would have surfaced this.

3. **Idempotency and question identity are architectural.** Bolting `questionId` onto the callback_data mid-implementation felt like a patch. It's actually the right design, but it should have appeared in the architecture sketch before code started.

## Lessons Learned

**Idempotency and identity belong in architectural design, not implementation detail.** For any callback-driven system, ask upfront: "How do we distinguish between a stale retry and a fresh request?" The answer (in this case: `questionId` + LRU deduplication) shapes the callback_data contract. Sketching this in the TDD test structure *before* implementation would have prevented the mid-flight redesign.

**Integration review for callback systems is mandatory.** Unit tests verify individual branches. Only integration thinking catches races like "user taps button from old notification after new notification overwrites the store." Make it explicit in the DoD: for callback-driven flows, code review must include a "stale callback from old state" scenario.

**Telegram keyboard edits need message_id capture.** This was a design gap: `sendMessage` returns `message_id` in the API response, but the renderer didn't thread it through to the pending-question entry. Lesson: if you might edit a message later, capture its ID at send time. Test this contract explicitly.

## Next Steps

1. **Manual QA pending.** User-facing flow on macOS: QR scan from real phone, `/start` recognized, option tap → terminal receives input. Not yet run in-session. Schedule 30 min block.

2. **Phase 02 entry scout.** Probe Claude Code `~/.claude/settings.json` HTTP hook schema with live Claude Code install. This unblocks phase-02 pairing hook (PreToolUse instead of JSONL regex).

3. **User-facing docs.** README or in-app settings copy explaining QR pairing. Deferred to phase-02 ship.

## One Takeaway

TDD caught the logic; integration review caught the state. Callback-driven systems need both, and they need review to include adversarial scenarios ("what if callback arrives late?" "what if message gets edited?"). The architecture should answer these questions before code starts; the tests should verify them; the review should assume they've been missed.
