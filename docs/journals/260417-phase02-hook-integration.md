# Phase 02 — Hook Integration & UUID Response Store

**Date:** 2026-04-17
**Plan:** `plans/260417-0159-telegram-mobile-control-3-phases/phase-02-hook-integration-and-uuid-response-store.md`
**Status:** ✅ DONE — 835/835 tests, typecheck + lint clean, code-reviewer must-fix resolved

## What changed

Replaced regex-over-xterm `reviewNeeded` detection with Claude Code's official
HTTP hook transport (`type: "http"` in `~/.claude/settings.json`). Added a
UUID-keyed persistent response store that survives terminal exit and app restart,
with 24h expiry and atomic writes. Wired `PermissionRequest` through the same
inline-keyboard pattern Phase 01 used for `AskUserQuestion`.

## New modules (all TDD — tests first)

| Module | Lines | Tests |
|---|---|---|
| `response-store.ts` | 175 | 13 — UUID files, 24h TTL, LRU cap, 0o600, atomic write with EBUSY fallback, crash-safe |
| `hook-server.ts` | 190 | 14 — 127.0.0.1 literal bind, timing-safe secret compare, 1 MB body cap, secret-redacted logs, crash isolation, 200-always |
| `hook-router.ts` | 180 | 11 — Stop / PreToolUse(AskUserQuestion) / PermissionRequest dispatch, defensive parse, 2s queue for unknown session_id, 30s permission timeout |
| `hook-installer.ts` | 195 | 12 — nested schema correctly per scout report, proper-lockfile, idempotent, uninstall by User-Agent marker, preserves unknown top-level keys, ccpoke coexistence |
| `pending-permission-store.ts` | 70 | covered via hook-router + permit callback tests |
| `ccpoke-coexistence.ts` | 70 | 7 — opencode-notify detection by filename + content + settings.json reference |
| `mobile-control-manager.ts` | 220 | 8 — end-to-end orchestration of server + router + installer + store + ccpoke |
| `mobile-control-settings.tsx` | 160 | 6 — toggle, status card, regen-secret confirm modal, ccpoke warning |

## Wired into existing code

- `notification-manager.ts`: hard-gate JSONL + OutputParser paths for `reviewNeeded`/`taskComplete` when mobile control is ON (no dedup window — pure gate). New `enableMobileControl` / `disableMobileControl` / `regenerateMobileControlSecret` / `getMobileControlStatus` methods. `handleHookEvent` fans Stop → taskComplete, AskUserQuestion → reviewNeeded, PermissionRequest → reviewNeeded+permissionId.
- `telegram-command-router.ts`: new `permit:<id>:<allow|deny>` callback reuses Phase 01 idempotency LRU + 10/s rate limiter.
- `telegram-notifier.ts`: `sendLongResponse` (.txt via Bot API `sendDocument`) for responses > 4000 chars — replaces Phase 03 web view. Inline "Allow / Deny" buttons on permission-request events.
- `ipc-channels.ts` + `handlers.ts` + `preload/index.ts`: new `MOBILE_CONTROL_*` channels + `mobileControl` API surface.
- `settings-panel.tsx`: "Mobile" tab.

## Decisions & deviations from the plan

1. **Scout report validated schema as nested-object, not flat array.** Plan said `hooks: []`; reality is `hooks: { <event>: [{matcher, hooks: [...]}] }`. Installer uses the real schema (see `plans/reports/scout-260417-claude-hook-schema.md`).
2. **`secretFingerprint` uses SHA-256 prefix, not raw secret slice.** Code-reviewer flagged the original `secret.slice(0,8)` as an info leak; switched to `createHash('sha256').update(secret).digest('hex').slice(0,8)`.
3. **Port allocation via `listen(0)`** rather than random ephemeral + retry. Simpler and OS-optimal.
4. **`sendLongResponse` triggers when the formatted Telegram message would exceed 4016 chars** (4096 − caption budget) AND the event carries a `responseId`. Sends compact caption + `.txt` attachment, then a one-line "Actions" message with the inline keyboard. Consolidates the Phase 03 web-view goal into Phase 02 as planned.
5. **Deferred:** Phase 03 (Cloudflare Quick Tunnel + mini web app) remains shelved. Document upload satisfies the long-response UX.

## Gotchas we hit

- **ESM namespace immutability.** Vitest can't `spyOn(fs/promises.rename)` in ESM; we had to add a `renameImpl` test seam on both `ResponseStore` and `HookInstaller` to simulate EBUSY / EACCES.
- **Hook race: unknown `session_id`.** Claude's JSONL watcher may not have bound the terminal yet when the hook fires. `HookRouter.resolveTerminalWithQueue` polls for up to 2s (default) before dropping. PermissionRequest holds its HTTP connection open across that window.
- **Async Stop handler.** Hook must return 200 within the budget; git-diff collection goes on a microtask and patches the stored entry via `responseStore.update(id, { gitDiff })` once complete. The plan's <100ms budget is preserved because `processStopAsync` does not block `handle()`.
- **Listener pile-up.** Re-enabling mobile control used to stack duplicate `hook:event` listeners. Now `NotificationManager.enableMobileControl` calls `removeAllListeners` before rebinding.

## Unresolved

- Manual QA across macOS + Linux: still required before shipping to beta. Current CI only runs unit tests.
- README section + screenshots.
- Two pre-existing lint warnings in `App.tsx` + `image-store.ts` — unrelated to Phase 02.

## Tests

Before: 827/827
After: 835/835 (+8 Phase-02 specs totaling ~95 new cases — `response-store` 13, `hook-server` 14, `hook-router` 11, `hook-installer` 12, `ccpoke-coexistence` 7, `mobile-control-manager` 8, `telegram-notifier-document-upload` 4, `telegram-command-router-permit` 5, `mobile-control-settings` 6)
