import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  attestSingleSoakEvidence,
  evaluateMemoryAcceptance,
  readSingleFlag,
  summarizeSteadyStateTrend,
  validateTerminalEvidence,
  workspaceRelativeEvidenceSource,
} from './packaged-terminal-soak-lib.mjs'

const input = process.argv[2]
if (!input) {
  throw new Error('usage: node analyze-packaged-terminal-memory.mjs <soak-evidence.json> --expected-policy=<policy> --expected-pane-count=<1|4|9>')
}
const flags = process.argv.slice(3)
const expectedPolicy = readSingleFlag(flags, 'expected-policy', '')
const expectedPaneCountValue = readSingleFlag(flags, 'expected-pane-count', '')
if (!/^(1|4|9)$/.test(expectedPaneCountValue)) {
  throw new Error('--expected-pane-count must be 1, 4, or 9')
}
const expectedPaneCount = Number.parseInt(expectedPaneCountValue, 10)
const evidence = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'))
const attestation = attestSingleSoakEvidence(evidence, { expectedPolicy, expectedPaneCount })
if (!attestation.ok) {
  throw new Error(`soak evidence attestation failed: ${attestation.failures.join('; ')}`)
}

const results = evidence.results.map(result => {
  const samples = result.rawAttributionSamples
  return {
    paneCount: result.paneCount,
    elapsedSeconds: result.elapsedSeconds,
    correctness: validateTerminalEvidence(result.terminalEvidence).ok,
    acceptance: evaluateMemoryAcceptance({
      samples,
      paneCount: result.paneCount,
      elapsedSeconds: result.elapsedSeconds,
      correctness: validateTerminalEvidence(result.terminalEvidence).ok,
    }),
    steadyState: {
      mainPrivateMiB: summarizeSteadyStateTrend(samples, 'mainPrivateMiB'),
      mainHeapUsedMiB: summarizeSteadyStateTrend(samples, 'mainHeapUsedMiB'),
      mainHeapTotalMiB: summarizeSteadyStateTrend(samples, 'mainHeapTotalMiB'),
      canonicalMiB: summarizeSteadyStateTrend(samples, 'canonicalBytes', 1 / 1_048_576),
    },
  }
})

const accepted = results.every(result => result.correctness && result.acceptance.ok)
process.stdout.write(`${JSON.stringify({
  source: workspaceRelativeEvidenceSource(input, process.cwd()),
  expectedPolicy,
  expectedPaneCount,
  accepted,
  results,
}, null, 2)}\n`)
if (!accepted) process.exitCode = 1
