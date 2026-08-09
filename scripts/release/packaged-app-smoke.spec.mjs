import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  packagedExecutableCandidates,
  packagedLaunchArgs,
  resolvePackagedExecutable,
} from './packaged-app-smoke-lib.mjs'

test('maps every supported platform to an unpacked executable', () => {
  assert.match(packagedExecutableCandidates('darwin', '/release')[0], /mac-arm64.*MultiClaude$/)
  assert.equal(packagedExecutableCandidates('win32', '/release')[0], path.join('/release', 'win-unpacked', 'MultiClaude.exe'))
  assert.equal(packagedExecutableCandidates('linux', '/release')[0], path.join('/release', 'linux-unpacked', 'multiclaude'))
})

test('resolves the first packaged executable that exists', () => {
  const releaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-smoke-resolver-'))
  try {
    const candidates = packagedExecutableCandidates('darwin', releaseDir)
    fs.mkdirSync(path.dirname(candidates[1]), { recursive: true })
    fs.writeFileSync(candidates[1], '')
    assert.equal(resolvePackagedExecutable('darwin', releaseDir), candidates[1])
  } finally {
    fs.rmSync(releaseDir, { recursive: true, force: true })
  }
})

test('fails closed for missing or unsupported packaged executables', () => {
  assert.throws(() => resolvePackagedExecutable('linux', '/missing-release'), /not found/)
  assert.throws(() => packagedExecutableCandidates('freebsd', '/release'), /Unsupported/)
})

test('disables Chromium sandbox only for the isolated Linux smoke harness', () => {
  assert.deepEqual(packagedLaunchArgs('linux', '/tmp/profile'), [
    '--user-data-dir=/tmp/profile',
    '--no-sandbox',
  ])
  assert.deepEqual(packagedLaunchArgs('darwin', '/tmp/profile'), ['--user-data-dir=/tmp/profile'])
  assert.deepEqual(packagedLaunchArgs('win32', 'C:\\profile'), ['--user-data-dir=C:\\profile'])
})
