import Store from 'electron-store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsStore } from '../settings-store'
import {
  beginSettingsMigration,
  confirmSettingsMigrationReady,
  recoverSettingsMigrationOnLaunch,
} from '../settings-migration-transaction'

const backup = { settingsSchemaVersion: 0, colorTheme: 'default' }
const candidate = {
  settingsSchemaVersion: 2,
  colorTheme: 'tokyo-night',
  terminalRendererPolicy: 'automatic',
}

interface DiskShape {
  settings?: Record<string, unknown>
  settingsMigration: ReturnType<typeof beginSettingsMigration> | null
}

interface StorePrototype {
  get(this: Store<DiskShape>, key: string): unknown
  set(this: Store<DiskShape>, key: string, value: unknown): void
}

const storePrototype = Store.prototype as unknown as StorePrototype

function seedDisk(
  cwd: string,
  settings: Record<string, unknown>,
): Store<DiskShape> {
  process.env['MULTICLAUDE_TEST_STORE_PATH'] = cwd
  const disk = new Store<DiskShape>({
    name: 'multiclaude-settings',
    cwd,
    defaults: { settingsMigration: null },
  })
  disk.set('settings', structuredClone(settings))
  disk.set('settingsMigration', null)
  return disk
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env['MULTICLAUDE_TEST_STORE_PATH']
})

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

  it('backs up the raw schema-v1 record and canonicalizes an interrupted restore in the next launch', () => {
    const cwd = 'settings-renderer-raw-backup'
    const raw = {
      settingsSchemaVersion: 1,
      terminalRenderMode: 'quality',
      gpuRendererForClaudeTerminals: false,
      colorTheme: 'dracula',
    }
    const disk = seedDisk(cwd, raw)

    const firstLaunch = new SettingsStore().getSettings()
    const firstTransaction = disk.get('settingsMigration')

    expect(firstLaunch.terminalRendererPolicy).toBe('prefer-gpu')
    expect(firstTransaction?.backup).toEqual(raw)
    expect(firstTransaction?.backup).not.toHaveProperty('terminalRendererPolicy')

    const recoveryLaunch = new SettingsStore().getSettings()
    const recoveryTransaction = disk.get('settingsMigration')

    expect(recoveryLaunch.terminalRendererPolicy).toBe('prefer-gpu')
    expect(recoveryLaunch).not.toHaveProperty('terminalRenderMode')
    expect(recoveryTransaction?.phase).toBe('candidate-written')
    expect(recoveryTransaction?.backup).toEqual(raw)
  })

  it.each([
    ['backup transaction write', 'backup-written'],
    ['candidate transaction write', 'candidate-written'],
    ['candidate settings write', 'settings'],
  ] as const)(
    'fails closed after one %s failure and recovers on the next launch',
    (_label, failureBoundary) => {
      const cwd = `settings-renderer-write-failure-${failureBoundary}`
      const raw = {
        settingsSchemaVersion: 1,
        terminalRenderMode: 'performance',
        gpuRendererForClaudeTerminals: true,
      }
      const disk = seedDisk(cwd, raw)
      const originalSet = storePrototype.set
      let candidateWrites = 0

      vi.spyOn(storePrototype, 'set').mockImplementation(function (
        this: Store<DiskShape>,
        key: string,
        value: unknown,
      ) {
        const record = value as Record<string, unknown> | null
        if (key === 'settings' && record?.terminalRendererPolicy) candidateWrites += 1
        const shouldFail =
          (failureBoundary === 'backup-written'
            && key === 'settingsMigration'
            && record?.phase === 'backup-written')
          || (failureBoundary === 'candidate-written'
            && key === 'settingsMigration'
            && record?.phase === 'candidate-written')
          || (failureBoundary === 'settings'
            && key === 'settings'
            && record?.terminalRendererPolicy !== undefined)
        if (shouldFail) throw new Error('private storage failure detail')
        return originalSet.call(this, key, value)
      })

      expect(() => new SettingsStore()).toThrow(
        'Settings migration failed; restart MultiClaude to retry.',
      )
      expect(candidateWrites).toBeLessThanOrEqual(1)

      vi.restoreAllMocks()
      const recovered = new SettingsStore().getSettings()

      expect(recovered.terminalRendererPolicy).toBe('safe-dom')
      expect(recovered).not.toHaveProperty('terminalRenderMode')
      expect(disk.get('settingsMigration')?.backup).toEqual(raw)
    },
  )

  it('retains recovery state and aborts when candidate read-back does not match', () => {
    const cwd = 'settings-renderer-candidate-mismatch'
    const raw = {
      settingsSchemaVersion: 1,
      terminalRenderMode: 'balanced',
      gpuRendererForClaudeTerminals: true,
    }
    const disk = seedDisk(cwd, raw)
    const originalGet = storePrototype.get
    let settingsReads = 0

    vi.spyOn(storePrototype, 'get').mockImplementation(function (
      this: Store<DiskShape>,
      key: string,
    ) {
      const value = originalGet.call(this, key)
      if (key === 'settings' && ++settingsReads === 2) {
        return { ...(value as Record<string, unknown>), terminalRendererPolicy: 'safe-dom' }
      }
      return value
    })

    expect(() => new SettingsStore()).toThrow(
      'Settings migration failed; restart MultiClaude to retry.',
    )
    expect(settingsReads).toBe(2)
    expect(disk.get('settingsMigration')?.backup).toEqual(raw)

    vi.restoreAllMocks()
    const recovered = new SettingsStore().getSettings()

    expect(recovered.terminalRendererPolicy).toBe('prefer-gpu')
    expect(recovered).not.toHaveProperty('terminalRenderMode')
  })
})
