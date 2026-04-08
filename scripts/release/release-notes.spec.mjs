import assert from 'node:assert/strict'
import test from 'node:test'

import { buildReleaseNotes } from './release-notes.mjs'

test('groups conventional commits and skips release-noise commits', () => {
  const notes = buildReleaseNotes({
    version: '3.1.1-beta.17',
    commits: [
      { hash: '1111111', subject: 'feat(renderer): add target release preview' },
      { hash: '2222222', subject: 'fix(ci): fail when draft release is missing' },
      { hash: '3333333', subject: 'docs(readme): explain draft-first release flow' },
      { hash: '4444444', subject: 'chore(release): v3.1.1-beta.17' },
    ],
  })

  assert.match(notes, /## Features/)
  assert.match(notes, /## Fixes/)
  assert.match(notes, /## Documentation/)
  assert.doesNotMatch(notes, /chore\(release\)/)
})

test('returns a fallback section when no grouped commits remain', () => {
  const notes = buildReleaseNotes({
    version: '3.1.1-beta.17',
    commits: [{ hash: '1111111', subject: 'chore(release): v3.1.1-beta.17' }],
  })

  assert.match(notes, /No user-facing changes were detected/)
})
