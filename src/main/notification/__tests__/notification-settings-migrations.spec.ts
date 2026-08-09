import { describe, expect, it } from 'vitest'
import { migrateNotificationSettings } from '../notification-settings-migrations'

describe('migrateNotificationSettings', () => {
  it('removes fake sound settings without touching channels or triggers', () => {
    const migrated = migrateNotificationSettings({
      onTaskComplete: false,
      onTaskFailed: true,
      telegramEnabled: true,
      discordEnabled: true,
      remoteControlEnabled: true,
      soundEnabled: true,
      soundPreset: 'retro',
    })

    expect(migrated).toEqual({
      onTaskComplete: false,
      onTaskFailed: true,
      telegramEnabled: true,
      discordEnabled: true,
      remoteControlEnabled: true,
    })
  })

  it('is idempotent', () => {
    const current = { telegramEnabled: true, outputMode: 'auto' }
    expect(migrateNotificationSettings(migrateNotificationSettings(current))).toEqual(current)
  })
})
