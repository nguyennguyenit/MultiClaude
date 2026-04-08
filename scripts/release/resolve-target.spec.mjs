import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveReleaseTarget } from './resolve-target.mjs'

const branchSet = (...branches) => new Set(branches)

test('resolves main to the repo default branch', () => {
  const resolved = resolveReleaseTarget({
    target: 'main',
    currentBranch: 'beta',
    defaultBranch: 'master',
    localBranches: branchSet('beta', 'master'),
    remoteBranches: branchSet('origin/beta', 'origin/master'),
  })

  assert.deepEqual(resolved, {
    target: 'main',
    resolvedBranch: 'master',
    channel: 'stable',
    requiresReleaseTypePrompt: false,
    requiresCustomStableConfirm: false,
    isCurrentBranchTarget: false,
  })
})

test('resolves current to the checked-out beta branch', () => {
  const resolved = resolveReleaseTarget({
    target: 'current',
    currentBranch: 'beta',
    defaultBranch: 'master',
    localBranches: branchSet('beta', 'master'),
    remoteBranches: branchSet('origin/beta', 'origin/master'),
  })

  assert.equal(resolved.resolvedBranch, 'beta')
  assert.equal(resolved.channel, 'beta')
  assert.equal(resolved.isCurrentBranchTarget, true)
})

test('resolves custom branches and flags release-type prompt', () => {
  const resolved = resolveReleaseTarget({
    target: 'release-candidate',
    currentBranch: 'beta',
    defaultBranch: 'master',
    localBranches: branchSet('beta'),
    remoteBranches: branchSet('origin/beta', 'origin/release-candidate'),
  })

  assert.equal(resolved.resolvedBranch, 'release-candidate')
  assert.equal(resolved.channel, 'custom')
  assert.equal(resolved.requiresReleaseTypePrompt, true)
})

test('falls back to a discovered master branch when origin HEAD is unavailable', () => {
  const resolved = resolveReleaseTarget({
    target: 'main',
    currentBranch: 'beta',
    defaultBranch: null,
    localBranches: branchSet('beta', 'master'),
    remoteBranches: branchSet('origin/beta', 'origin/master'),
  })

  assert.equal(resolved.resolvedBranch, 'master')
  assert.equal(resolved.channel, 'stable')
})

test('throws when the requested custom branch does not exist', () => {
  assert.throws(
    () =>
      resolveReleaseTarget({
        target: 'does-not-exist',
        currentBranch: 'beta',
        defaultBranch: 'master',
        localBranches: branchSet('beta', 'master'),
        remoteBranches: branchSet('origin/beta', 'origin/master'),
      }),
    /Branch "does-not-exist" does not exist/
  )
})
