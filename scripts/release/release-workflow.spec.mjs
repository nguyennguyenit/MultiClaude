import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8')
const packageJson = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'))

test('runs the AppImage smoke without requiring FUSE on the hosted runner', () => {
  assert.match(
    workflow,
    /timeout 15s xvfb-run -a "\$APPIMAGE_PATH" --appimage-extract-and-run --no-sandbox/,
  )
})

test('keeps macOS releases compatible with the previous ad-hoc signing contract', () => {
  assert.match(workflow, /- name: Build with manifests \(all platforms\)[\s\S]*?run: npm run build:ci/)
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY: false/)
  assert.match(packageJson.scripts['build:ci'], /-c\.mac\.identity=-/)

  for (const productionOnlySetting of [
    'MAC_CSC_LINK',
    'MAC_CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
    'build:release:mac',
    'spctl --assess',
    'xcrun stapler validate',
  ]) {
    assert.doesNotMatch(workflow, new RegExp(productionOnlySetting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('runs every verification command in a fail-fast workflow step', () => {
  for (const [name, command] of [
    ['Verify types', 'npm run typecheck'],
    ['Verify lint', 'npm run lint'],
    ['Verify unit tests', 'npm test'],
    ['Verify benchmarks', 'npm run test:benchmarks'],
    ['Verify release scripts', 'npm run test:release'],
  ]) {
    assert.match(workflow, new RegExp(`- name: ${name}\\n\\s+run: ${command.replace(/\//g, '\\/')}`))
  }

  assert.doesNotMatch(workflow, /run: \|\n(?:\s+npm (?:run )?[^\n]+\n){2,}/)
})
