import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { evaluateMemoryAcceptance, summarizeSteadyStateTrend } from './packaged-terminal-soak-lib.mjs'

const input = process.argv[2]
if (!input) throw new Error('usage: node analyze-packaged-terminal-memory.mjs <soak-evidence.json>')
const evidence = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'))
if (!Array.isArray(evidence.results) || evidence.results.length === 0) {
  throw new Error('soak evidence must contain at least one result')
}

const results = evidence.results.map(result => {
  const samples = result.rawAttributionSamples
  return {
    paneCount: result.paneCount,
    elapsedSeconds: result.elapsedSeconds,
    correctness: result.terminalEvidence.ok,
    acceptance: evaluateMemoryAcceptance({
      samples,
      paneCount: result.paneCount,
      elapsedSeconds: result.elapsedSeconds,
      correctness: result.terminalEvidence.ok,
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
process.stdout.write(`${JSON.stringify({ source: path.resolve(input), accepted, results }, null, 2)}\n`)
if (!accepted) process.exitCode = 1
