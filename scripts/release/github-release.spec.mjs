import assert from 'node:assert/strict'
import test from 'node:test'

import { selectWorkflowRun } from './github-release.mjs'

test('selectWorkflowRun prefers the matching tag sha when multiple dispatches exist', () => {
  const runs = [
    {
      event: 'workflow_dispatch',
      headBranch: 'v3.1.1-beta.17',
      headSha: 'older-sha',
      createdAt: '2026-04-08T13:01:00.000Z',
    },
    {
      event: 'workflow_dispatch',
      headBranch: 'v3.1.1-beta.17',
      headSha: 'target-sha',
      createdAt: '2026-04-08T13:02:00.000Z',
    },
  ]

  const selected = selectWorkflowRun(runs, {
    tag: 'v3.1.1-beta.17',
    tagSha: 'target-sha',
    startedAt: Date.parse('2026-04-08T13:00:00.000Z'),
  })

  assert.equal(selected.headSha, 'target-sha')
})

test('selectWorkflowRun falls back to the tag branch when github omits head sha', () => {
  const runs = [
    {
      event: 'workflow_dispatch',
      headBranch: 'v3.1.1-beta.17',
      createdAt: '2026-04-08T13:02:00.000Z',
    },
  ]

  const selected = selectWorkflowRun(runs, {
    tag: 'v3.1.1-beta.17',
    tagSha: 'target-sha',
    startedAt: Date.parse('2026-04-08T13:00:00.000Z'),
  })

  assert.equal(selected.headBranch, 'v3.1.1-beta.17')
})
