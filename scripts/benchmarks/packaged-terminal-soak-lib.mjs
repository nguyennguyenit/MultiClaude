const SUPPORTED_PANE_COUNTS = new Set([1, 4, 9])

function positiveInteger(value, flagName) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${flagName} must be a positive integer`)
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`)
  }
  return parsed
}

function nonNegativeInteger(value, flagName) {
  if (!/^\d+$/.test(value)) throw new Error(`${flagName} must be a non-negative integer`)
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed)) throw new Error(`${flagName} must be a non-negative integer`)
  return parsed
}

export function readSingleFlag(argumentsList, name, fallback) {
  const prefix = `--${name}=`
  const matches = argumentsList.filter(argument => argument.startsWith(prefix))
  if (matches.length > 1) throw new Error(`--${name} must be provided only once`)
  return matches[0]?.slice(prefix.length) ?? fallback
}

export function parseSoakArguments(argumentsList) {
  const paneCountsValue = readSingleFlag(argumentsList, 'pane-counts', '1,4,9')
  const paneCounts = paneCountsValue.split(',').map(value => positiveInteger(value, '--pane-counts'))

  if (paneCounts.length === 0 || paneCounts.some(value => !SUPPORTED_PANE_COUNTS.has(value))) {
    throw new Error('--pane-counts must contain only 1, 4, or 9')
  }
  if (new Set(paneCounts).size !== paneCounts.length) {
    throw new Error('--pane-counts must not contain duplicates')
  }

  return {
    paneCounts,
    durationSeconds: positiveInteger(readSingleFlag(argumentsList, 'duration-seconds', '30'), '--duration-seconds'),
    sampleIntervalMs: positiveInteger(readSingleFlag(argumentsList, 'sample-interval-ms', '5000'), '--sample-interval-ms'),
    canonicalIntervalSeconds: nonNegativeInteger(
      readSingleFlag(argumentsList, 'canonical-interval-seconds', '0'),
      '--canonical-interval-seconds',
    ),
  }
}

function round(value) {
  return Number(value.toFixed(2))
}

export function summarizeProcessSamples(samples) {
  const observations = new Map()
  for (const sample of samples) {
    const key = `${sample.recordedAtMs}:${sample.type}`
    const observation = observations.get(key) ?? {
      recordedAtMs: sample.recordedAtMs,
      type: sample.type,
      workingSetMiB: 0,
      cpuPercent: 0,
    }
    observation.workingSetMiB += sample.workingSetMiB
    observation.cpuPercent += sample.cpuPercent
    observations.set(key, observation)
  }

  const groups = new Map()
  for (const sample of [...observations.values()].sort((left, right) => left.recordedAtMs - right.recordedAtMs)) {
    const group = groups.get(sample.type) ?? []
    group.push(sample)
    groups.set(sample.type, group)
  }

  return Object.fromEntries([...groups.entries()].map(([type, group]) => [type, {
    samples: group.length,
    peakWorkingSetMiB: round(Math.max(...group.map(sample => sample.workingSetMiB))),
    finalWorkingSetMiB: round(group.at(-1).workingSetMiB),
    peakCpuPercent: round(Math.max(...group.map(sample => sample.cpuPercent))),
  }]))
}

function summarizeRange(samples, key) {
  const values = samples.map(sample => sample[key])
  return {
    first: round(values[0]),
    peak: round(Math.max(...values)),
    final: round(values.at(-1)),
  }
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

export function aggregateCanonicalEvidence(markerResults) {
  const aggregate = { bytes: 0, watermark: 0 }
  for (const result of markerResults) {
    requireNonNegativeInteger(result.canonical?.bytes, 'canonical bytes')
    requireNonNegativeInteger(result.canonical?.watermark, 'canonical watermark')
    aggregate.bytes += result.canonical.bytes
    aggregate.watermark += result.canonical.watermark
    requireNonNegativeInteger(aggregate.bytes, 'aggregate canonical bytes')
    requireNonNegativeInteger(aggregate.watermark, 'aggregate canonical watermark')
  }
  return aggregate
}

export function validateAttributionSample(sample) {
  const memoryFields = [
    'recordedAtMs',
    'mainPrivateMiB',
    'mainSharedMiB',
    'mainHeapUsedMiB',
    'mainHeapTotalMiB',
  ]
  for (const field of memoryFields) {
    if (!Number.isFinite(sample[field]) || sample[field] < 0) {
      throw new Error(`${field} must be finite and non-negative`)
    }
  }
  requireNonNegativeInteger(sample.canonicalBytes, 'canonicalBytes')
  requireNonNegativeInteger(sample.canonicalWatermark, 'canonicalWatermark')
  if (!Number.isSafeInteger(sample.terminalCount) || sample.terminalCount <= 0) {
    throw new Error('terminalCount must be a positive integer')
  }
  if (sample.mainHeapUsedMiB > sample.mainHeapTotalMiB) {
    throw new Error('mainHeapUsedMiB must not exceed mainHeapTotalMiB')
  }
}

export function summarizeAttributionSamples(samples) {
  if (samples.length === 0) throw new Error('attribution samples are required')
  for (const sample of samples) validateAttributionSample(sample)

  return {
    samples: samples.length,
    mainPrivateMiB: summarizeRange(samples, 'mainPrivateMiB'),
    mainSharedMiB: summarizeRange(samples, 'mainSharedMiB'),
    mainHeapUsedMiB: summarizeRange(samples, 'mainHeapUsedMiB'),
    mainHeapTotalMiB: summarizeRange(samples, 'mainHeapTotalMiB'),
    canonicalBytes: summarizeRange(samples, 'canonicalBytes'),
    canonicalWatermark: {
      first: samples[0].canonicalWatermark,
      final: samples.at(-1).canonicalWatermark,
    },
    terminalCount: samples.at(-1).terminalCount,
  }
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function summarizeTrendPoints(samples, key, scale) {
  if (samples.length < 4) throw new Error('at least four samples are required for a steady-state trend')
  const points = samples.map(sample => ({
    minutes: sample.recordedAtMs / 60_000,
    value: sample[key] * scale,
  }))
  if (points.some(point => !Number.isFinite(point.minutes) || !Number.isFinite(point.value))) {
    throw new Error(`${key} trend values must be finite`)
  }
  const meanTime = points.reduce((sum, point) => sum + point.minutes, 0) / points.length
  const meanValue = points.reduce((sum, point) => sum + point.value, 0) / points.length
  const denominator = points.reduce((sum, point) => sum + (point.minutes - meanTime) ** 2, 0)
  if (denominator === 0) throw new Error('steady-state samples must span time')
  const slope = points.reduce(
    (sum, point) => sum + (point.minutes - meanTime) * (point.value - meanValue),
    0,
  ) / denominator
  const tailSize = Math.max(1, Math.floor(points.length / 5))
  const firstWindowMedian = median(points.slice(0, tailSize).map(point => point.value))
  const finalWindowMedian = median(points.slice(-tailSize).map(point => point.value))
  const minimum = Math.min(...points.map(point => point.value))
  const maximum = Math.max(...points.map(point => point.value))
  const observedRange = maximum - minimum
  return {
    samples: points.length,
    slopePerMinute: round(slope),
    firstWindowMedian: round(firstWindowMedian),
    finalWindowMedian: round(finalWindowMedian),
    windowMedianDrift: round(finalWindowMedian - firstWindowMedian),
    driftAsRangeFraction: observedRange === 0
      ? 0
      : round((finalWindowMedian - firstWindowMedian) / observedRange),
    minimum: round(minimum),
    maximum: round(maximum),
  }
}

/** OLS trend over the second half of a run, after startup/warm-up effects. */
export function summarizeSteadyStateTrend(samples, key, scale = 1) {
  if (samples.length < 4) throw new Error('at least four samples are required for a steady-state trend')
  const steady = samples.slice(Math.floor(samples.length / 2))
  return summarizeTrendPoints(steady, key, scale)
}

/** Trend over an explicit elapsed-time window, used after bounded buffers saturate. */
export function summarizeTrendWindow(samples, key, startAtMs, scale = 1) {
  if (!Number.isFinite(startAtMs) || startAtMs < 0) throw new Error('startAtMs must be finite and non-negative')
  return summarizeTrendPoints(samples.filter(sample => sample.recordedAtMs >= startAtMs), key, scale)
}

/**
 * Fail-closed memory gate for the deterministic 30-minute packaged soak.
 * The last ten minutes are evaluated after the 20k-line canonical scrollback
 * and bounded restore tail have saturated. Budgets scale with pane count and
 * use window medians so expected V8 GC spikes do not masquerade as retention.
 */
export function evaluateMemoryAcceptance({ samples, paneCount, elapsedSeconds, correctness }) {
  const failures = []
  if (correctness !== true) failures.push('terminal correctness failed')
  if (!Number.isInteger(paneCount) || paneCount <= 0) failures.push('paneCount must be a positive integer')
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 1_800) failures.push('memory soak must run for at least 1800 seconds')
  if (failures.length > 0) return { ok: false, failures }

  const startAtMs = elapsedSeconds * 1_000 - 10 * 60_000
  const windowSamples = samples.filter(sample => sample.recordedAtMs >= startAtMs)
  if (windowSamples.length < 60) {
    return { ok: false, failures: ['post-saturation window requires at least 60 samples'] }
  }

  const trends = {
    mainPrivateMiB: summarizeTrendPoints(windowSamples, 'mainPrivateMiB', 1),
    mainHeapUsedMiB: summarizeTrendPoints(windowSamples, 'mainHeapUsedMiB', 1),
    canonicalMiB: summarizeTrendPoints(windowSamples, 'canonicalBytes', 1 / 1_048_576),
  }
  const limits = {
    mainPrivateSlopePerMinute: round(0.25 * paneCount),
    mainPrivateMedianDriftMiB: round(4 * paneCount),
    mainHeapSlopePerMinute: round(0.15 * paneCount),
    mainHeapMedianDriftMiB: round(2 * paneCount),
    canonicalSlopePerMinute: round(0.01 * paneCount),
    canonicalMedianDriftMiB: round(0.05 * paneCount),
  }
  const checks = [
    ['main private slope', trends.mainPrivateMiB.slopePerMinute, limits.mainPrivateSlopePerMinute],
    ['main private median drift', trends.mainPrivateMiB.windowMedianDrift, limits.mainPrivateMedianDriftMiB],
    ['main heap slope', trends.mainHeapUsedMiB.slopePerMinute, limits.mainHeapSlopePerMinute],
    ['main heap median drift', trends.mainHeapUsedMiB.windowMedianDrift, limits.mainHeapMedianDriftMiB],
    ['canonical slope', trends.canonicalMiB.slopePerMinute, limits.canonicalSlopePerMinute],
    ['canonical median drift', trends.canonicalMiB.windowMedianDrift, limits.canonicalMedianDriftMiB],
  ]
  for (const [label, observed, limit] of checks) {
    if (observed > limit) failures.push(`${label} ${observed} exceeded ${limit}`)
  }
  return { ok: failures.length === 0, failures, startAtMs, limits, trends }
}

export function validateTerminalEvidence({ terminalIds, streams, liveMarkers, canonicalMarkers }) {
  const failures = []

  for (const terminalId of terminalIds) {
    const stream = streams[terminalId]
    if (!stream) {
      failures.push(`${terminalId}: missing stream evidence`)
      continue
    }
    if (stream.firstSequence !== 1) failures.push(`${terminalId}: first sequence was ${stream.firstSequence}, expected 1`)
    if (stream.lastSequence - stream.firstSequence + 1 !== stream.chunks) {
      failures.push(`${terminalId}: sequence range does not match ${stream.chunks} observed chunks`)
    }
    if (stream.gaps !== 0) failures.push(`${terminalId}: ${stream.gaps} sequence gap(s)`)
    if (stream.duplicates !== 0) failures.push(`${terminalId}: ${stream.duplicates} duplicate sequence(s)`)
    if (stream.epochs.length !== 1) failures.push(`${terminalId}: expected one epoch, observed ${stream.epochs.length}`)
    if (liveMarkers[terminalId] !== true) failures.push(`${terminalId}: final live marker missing from sequenced IPC output`)
    if (canonicalMarkers[terminalId] !== true) failures.push(`${terminalId}: final canonical marker missing from snapshot`)
  }

  return { ok: failures.length === 0, failures }
}
