import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildVersionPlan,
  collectLatestVersions,
  detectDuplicateVersion,
} from './versioning.mjs'

test('collects the latest stable and beta tags from mixed history', () => {
  const versions = collectLatestVersions([
    'v3.0.9',
    'v3.1.0',
    'v3.1.1-beta.15',
    'v3.1.1-beta.16',
  ])

  assert.equal(versions.latestStable, '3.1.0')
  assert.equal(versions.latestBeta, '3.1.1-beta.16')
})

test('suggests the next beta version from current repo state', () => {
  const versionPlan = buildVersionPlan({
    channel: 'beta',
    currentVersion: '3.1.1-beta.16',
    latestStable: '3.1.0',
    latestBeta: '3.1.1-beta.16',
  })

  assert.equal(versionPlan.suggestedVersion, '3.1.1-beta.17')
  assert.equal(versionPlan.requiresVersionPrompt, false)
})

test('bumps beta base version when stable has already caught up', () => {
  const versionPlan = buildVersionPlan({
    channel: 'beta',
    currentVersion: '3.0.0-beta.4',
    latestStable: '3.0.0',
    latestBeta: '3.0.0-beta.4',
  })

  assert.equal(versionPlan.suggestedVersion, '3.0.1-beta.1')
})

test('suggests the next stable version from the latest beta tag', () => {
  const versionPlan = buildVersionPlan({
    channel: 'stable',
    currentVersion: '3.1.0',
    latestStable: '3.1.0',
    latestBeta: '3.1.1-beta.16',
  })

  assert.equal(versionPlan.suggestedVersion, '3.1.1')
  assert.equal(versionPlan.requiresVersionPrompt, true)
})

test('does not auto-suggest final versions for custom branches', () => {
  const versionPlan = buildVersionPlan({
    channel: 'custom',
    currentVersion: '3.1.1-beta.16',
    latestStable: '3.1.0',
    latestBeta: '3.1.1-beta.16',
  })

  assert.equal(versionPlan.suggestedVersion, null)
  assert.equal(versionPlan.requiresVersionPrompt, true)
})

test('flags duplicate tags and releases in preflight state', () => {
  const duplicateState = detectDuplicateVersion({
    version: '3.1.1-beta.17',
    tagExists: true,
    releaseExists: false,
  })

  assert.equal(duplicateState.duplicateTag, true)
  assert.equal(duplicateState.duplicateRelease, false)
  assert.equal(duplicateState.hasDuplicate, true)
})
