import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldUseAdHocSigning } from '../after-pack-mac-sign.js'

const certificateKey = ['CSC', 'LINK'].join('_')
const identityKey = ['CSC', 'NAME'].join('_')

test('uses ad-hoc signing only when production signing is not configured', () => {
  assert.equal(shouldUseAdHocSigning({}), true)
  assert.equal(shouldUseAdHocSigning({ [certificateKey]: 'configured' }), false)
  assert.equal(shouldUseAdHocSigning({ [identityKey]: 'configured' }), false)
})
