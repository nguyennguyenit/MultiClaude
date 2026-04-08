const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/

function parseVersion(version) {
  if (!version) {
    return null
  }

  const match = VERSION_PATTERN.exec(version.trim())

  if (!match) {
    return null
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    beta: match[4] ? Number(match[4]) : null,
  }
}

function formatVersion(version) {
  const base = `${version.major}.${version.minor}.${version.patch}`
  return version.beta == null ? base : `${base}-beta.${version.beta}`
}

function compareBaseVersions(left, right) {
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  return left.patch - right.patch
}

function compareVersions(left, right) {
  const baseDiff = compareBaseVersions(left, right)

  if (baseDiff !== 0) {
    return baseDiff
  }

  if (left.beta == null && right.beta == null) return 0
  if (left.beta == null) return 1
  if (right.beta == null) return -1
  return left.beta - right.beta
}

function incrementPatch(version) {
  return {
    major: version.major,
    minor: version.minor,
    patch: version.patch + 1,
    beta: null,
  }
}

function maxBaseVersion(versions) {
  return versions.reduce((latest, current) => {
    if (!latest) return current
    return compareBaseVersions(current, latest) > 0 ? current : latest
  }, null)
}

function sameBaseVersion(left, right) {
  return compareBaseVersions(left, right) === 0
}

function suggestNextBetaVersion({ currentVersion, latestStable, latestBeta }) {
  const current = parseVersion(currentVersion)
  const stable = parseVersion(latestStable)
  const beta = parseVersion(latestBeta)
  const baseCandidate = maxBaseVersion([current, beta].filter(Boolean))

  if (!baseCandidate) {
    throw new Error('Unable to suggest a beta version without current or historical versions.')
  }

  const resolvedBase =
    stable && compareBaseVersions(stable, baseCandidate) >= 0
      ? incrementPatch(stable)
      : {
          major: baseCandidate.major,
          minor: baseCandidate.minor,
          patch: baseCandidate.patch,
          beta: null,
        }

  const nextBeta = [current, beta]
    .filter(candidate => candidate?.beta != null && sameBaseVersion(candidate, resolvedBase))
    .reduce((maxBeta, candidate) => Math.max(maxBeta, candidate.beta), 0)

  return formatVersion({
    ...resolvedBase,
    beta: nextBeta + 1,
  })
}

function suggestNextStableVersion({ currentVersion, latestStable, latestBeta }) {
  const current = parseVersion(currentVersion)
  const stable = parseVersion(latestStable)
  const beta = parseVersion(latestBeta)

  if (beta && (!stable || compareBaseVersions(beta, stable) > 0)) {
    return formatVersion({
      major: beta.major,
      minor: beta.minor,
      patch: beta.patch,
      beta: null,
    })
  }

  const highestStableBase = maxBaseVersion(
    [stable, current].filter(candidate => candidate && candidate.beta == null)
  )

  if (!highestStableBase) {
    throw new Error('Unable to suggest a stable version from the current repo state.')
  }

  return formatVersion(incrementPatch(highestStableBase))
}

export function collectLatestVersions(tags = []) {
  return tags.reduce(
    (summary, tag) => {
      const parsed = parseVersion(tag)

      if (!parsed) {
        return summary
      }

      if (parsed.beta == null) {
        if (!summary.latestStable || compareVersions(parsed, parseVersion(summary.latestStable)) > 0) {
          summary.latestStable = formatVersion(parsed)
        }
      } else if (!summary.latestBeta || compareVersions(parsed, parseVersion(summary.latestBeta)) > 0) {
        summary.latestBeta = formatVersion(parsed)
      }

      return summary
    },
    { latestStable: null, latestBeta: null }
  )
}

export function buildVersionPlan({ channel, currentVersion, latestStable, latestBeta }) {
  if (channel === 'beta') {
    return {
      suggestedVersion: suggestNextBetaVersion({ currentVersion, latestStable, latestBeta }),
      requiresVersionPrompt: false,
      defaultReleaseType: 'prerelease',
    }
  }

  if (channel === 'stable') {
    return {
      suggestedVersion: suggestNextStableVersion({ currentVersion, latestStable, latestBeta }),
      requiresVersionPrompt: true,
      defaultReleaseType: 'stable',
    }
  }

  return {
    suggestedVersion: null,
    requiresVersionPrompt: true,
    defaultReleaseType: 'prerelease',
  }
}

export function detectDuplicateVersion({ version, tagExists, releaseExists }) {
  if (!parseVersion(version)) {
    throw new Error(`Invalid release version "${version}".`)
  }

  return {
    duplicateTag: Boolean(tagExists),
    duplicateRelease: Boolean(releaseExists),
    hasDuplicate: Boolean(tagExists || releaseExists),
  }
}

export function isValidReleaseVersion(version) {
  return parseVersion(version) != null
}

export function normalizeReleaseVersion(version) {
  const parsed = parseVersion(version)

  if (!parsed) {
    throw new Error(`Invalid release version "${version}".`)
  }

  return formatVersion(parsed)
}
