import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { _electron as electron } from '@playwright/test'
import { resolvePackagedExecutable } from './packaged-app-smoke-lib.mjs'

const executableArgument = process.argv.find(argument => argument.startsWith('--executable='))
const executablePath = executableArgument
  ? path.resolve(executableArgument.slice('--executable='.length))
  : resolvePackagedExecutable(process.platform)
if (!fs.existsSync(executablePath)) throw new Error(`Packaged executable not found: ${executablePath}`)
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'multiclaude-package-smoke-'))
let electronApp

try {
  electronApp = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${profilePath}`],
    timeout: 60_000,
  })
  const window = await electronApp.firstWindow({ timeout: 30_000 })
  await window.waitForLoadState('domcontentloaded')
  const runtime = await electronApp.evaluate(({ app }) => ({
    appVersion: app.getVersion(), isPackaged: app.isPackaged,
    platform: process.platform, arch: process.arch,
  }))
  if (!runtime.isPackaged) throw new Error('Smoke target is not a packaged application')

  const capability = await window.evaluate(() => window.electron.terminal.getNativeCapability())
  const terminal = await window.evaluate(cwd => window.electron.terminal.create({ cwd }), profilePath)
  const snapshot = await window.evaluate(id => window.electron.terminal.getSnapshot(id), terminal.id)
  const diagnostics = await window.evaluate(() => window.electron.terminal.getDiagnostics())
  await window.evaluate(id => window.electron.terminal.destroy(id), terminal.id)
  if (!('watermark' in snapshot) || !('streamEpoch' in snapshot)) {
    throw new Error('Packaged application did not expose the exact-once snapshot contract')
  }
  if (capability.available) throw new Error('Ghostty capability must remain unavailable after Stage 0 no-go')
  const terminalDiagnostic = diagnostics.find(diagnostic => diagnostic.terminalId === terminal.id)
  if (!terminalDiagnostic) throw new Error('Packaged application did not report terminal diagnostics')
  if ('ansi' in terminalDiagnostic || 'data' in terminalDiagnostic) {
    throw new Error('Terminal diagnostics must not contain transcript fields')
  }

  process.stdout.write(`${JSON.stringify({
    ok: true, executablePath, runtime,
    terminal: { engine: 'xterm', streamEpochPresent: snapshot.streamEpoch.length > 0, watermark: snapshot.watermark },
    diagnostic: terminalDiagnostic,
    nativeCapability: capability,
  }, null, 2)}\n`)
} finally {
  if (electronApp) await electronApp.close().catch(() => undefined)
  fs.rmSync(profilePath, { recursive: true, force: true })
}
