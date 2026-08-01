import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8')

test('runs the AppImage smoke without requiring FUSE on the hosted runner', () => {
  assert.match(
    workflow,
    /timeout 15s xvfb-run -a "\$APPIMAGE_PATH" --appimage-extract-and-run --no-sandbox/,
  )
})

test('fails fast when production macOS release credentials are absent', () => {
  const validationStart = workflow.indexOf('- name: Validate macOS release credentials')
  const installStart = workflow.indexOf('- name: Install dependencies')
  const buildStart = workflow.indexOf('- name: Build, sign, and notarize (macOS)')

  assert.notEqual(validationStart, -1)
  assert.ok(validationStart < installStart)
  assert.ok(installStart < buildStart)

  const validationStep = workflow.slice(validationStart, buildStart)
  for (const name of [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
  ]) {
    assert.match(validationStep, new RegExp(`\\b${name}\\b`))
  }
  assert.match(validationStep, /if \[ -z "\$\{!name:-\}" \]/)
  assert.match(validationStep, /Missing required macOS release credentials/)
  assert.match(validationStep, /exit 1/)
})
