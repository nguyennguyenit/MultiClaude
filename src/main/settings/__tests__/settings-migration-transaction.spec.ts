import { describe, expect, it } from 'vitest'
import {
  beginSettingsMigration,
  confirmSettingsMigrationReady,
  recoverSettingsMigrationOnLaunch,
} from '../settings-migration-transaction'

const backup = { settingsSchemaVersion: 0, colorTheme: 'default' }
const candidate = { settingsSchemaVersion: 1, colorTheme: 'tokyo-night' }

describe('settings migration transaction', () => {
  it.each(['backup-written', 'candidate-written'] as const)(
    'restores the backup after a %s interruption',
    (phase) => {
      const recovered = recoverSettingsMigrationOnLaunch(candidate, {
        phase,
        backup,
        candidate,
      })

      expect(recovered.settings).toEqual(backup)
      expect(recovered.transaction).toBeNull()
      expect(recovered.restoredBackup).toBe(true)
    },
  )

  it('keeps a confirmed candidate backup until the following launch is ready', () => {
    const transaction = confirmSettingsMigrationReady(
      beginSettingsMigration(backup, candidate),
    )
    expect(transaction).not.toBeNull()
    const recovered = recoverSettingsMigrationOnLaunch(candidate, transaction!)

    expect(recovered.settings).toEqual(candidate)
    expect(recovered.transaction?.phase).toBe('next-launch-expiry-pending')
    expect(confirmSettingsMigrationReady(recovered.transaction!)).toBeNull()
  })

  it('keeps the backup when the expiry launch crashes before readiness', () => {
    const confirmed = confirmSettingsMigrationReady(
      beginSettingsMigration(backup, candidate),
    )!
    const expiryLaunch = recoverSettingsMigrationOnLaunch(candidate, confirmed)
    const afterCrash = recoverSettingsMigrationOnLaunch(
      candidate,
      expiryLaunch.transaction,
    )

    expect(afterCrash.settings).toEqual(candidate)
    expect(afterCrash.transaction?.phase).toBe('next-launch-expiry-pending')
  })

  it('records backup before candidate and marks readiness explicitly', () => {
    const pending = beginSettingsMigration(backup, candidate)

    expect(pending.phase).toBe('candidate-written')
    expect(pending.backup).toEqual(backup)
    expect(pending.candidate).toEqual(candidate)
    expect(confirmSettingsMigrationReady(pending)?.phase).toBe('app-ready-confirmed')
  })
})
