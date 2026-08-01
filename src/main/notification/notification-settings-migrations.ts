const RETIRED_NOTIFICATION_KEYS = new Set(['soundEnabled', 'soundPreset'])

export function migrateNotificationSettings(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => !RETIRED_NOTIFICATION_KEYS.has(key)),
  )
}
