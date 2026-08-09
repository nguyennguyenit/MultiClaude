export type SettingsRecord = Record<string, unknown>
export type SettingsMigrationPhase =
  | 'backup-written'
  | 'candidate-written'
  | 'app-ready-confirmed'
  | 'next-launch-expiry-pending'

export interface SettingsMigrationTransaction {
  phase: SettingsMigrationPhase
  backup: SettingsRecord
  candidate: SettingsRecord
}

export function beginSettingsMigration(
  backup: SettingsRecord,
  candidate: SettingsRecord,
): SettingsMigrationTransaction {
  return {
    phase: 'candidate-written',
    backup: structuredClone(backup),
    candidate: structuredClone(candidate),
  }
}

export function confirmSettingsMigrationReady(
  transaction: SettingsMigrationTransaction,
): SettingsMigrationTransaction | null {
  if (transaction.phase === 'next-launch-expiry-pending') return null
  return { ...transaction, phase: 'app-ready-confirmed' }
}

export function recoverSettingsMigrationOnLaunch(
  settings: SettingsRecord,
  transaction: SettingsMigrationTransaction | null | undefined,
): {
  settings: SettingsRecord
  transaction: SettingsMigrationTransaction | null
  restoredBackup: boolean
} {
  if (!transaction) {
    return { settings, transaction: null, restoredBackup: false }
  }
  if (transaction.phase === 'app-ready-confirmed') {
    return {
      settings,
      transaction: { ...transaction, phase: 'next-launch-expiry-pending' },
      restoredBackup: false,
    }
  }
  if (transaction.phase === 'next-launch-expiry-pending') {
    return { settings, transaction, restoredBackup: false }
  }
  return {
    settings: structuredClone(transaction.backup),
    transaction: null,
    restoredBackup: true,
  }
}
