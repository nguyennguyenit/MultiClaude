const STABLE_FALLBACK_BRANCHES = ['main', 'master']

function hasBranch(branches, branchName) {
  return (
    branches.has(branchName) ||
    branches.has(`origin/${branchName}`) ||
    branches.has(`remotes/origin/${branchName}`)
  )
}

function resolveStableBranch({ defaultBranch, localBranches, remoteBranches }) {
  const allBranches = new Set([...localBranches, ...remoteBranches])

  if (defaultBranch && hasBranch(allBranches, defaultBranch)) {
    return defaultBranch
  }

  for (const fallbackBranch of STABLE_FALLBACK_BRANCHES) {
    if (hasBranch(allBranches, fallbackBranch)) {
      return fallbackBranch
    }
  }

  throw new Error('Unable to resolve the stable branch alias for target "main".')
}

function determineChannel(resolvedBranch, stableBranch) {
  if (stableBranch && resolvedBranch === stableBranch) {
    return 'stable'
  }

  if (resolvedBranch === 'beta') {
    return 'beta'
  }

  return 'custom'
}

export function resolveReleaseTarget({
  target,
  currentBranch,
  defaultBranch,
  localBranches = new Set(),
  remoteBranches = new Set(),
}) {
  if (!target) {
    throw new Error('A release target is required.')
  }

  let stableBranch = null
  let resolvedBranch

  if (target === 'current') {
    resolvedBranch = currentBranch
  } else if (target === 'main') {
    stableBranch = resolveStableBranch({
      defaultBranch,
      localBranches,
      remoteBranches,
    })
    resolvedBranch = stableBranch
  } else if (target === 'beta') {
    resolvedBranch = 'beta'
  } else {
    const allBranches = new Set([...localBranches, ...remoteBranches])

    if (!hasBranch(allBranches, target)) {
      throw new Error(`Branch "${target}" does not exist locally or on origin.`)
    }

    resolvedBranch = target
  }

  if (target === 'current') {
    stableBranch = resolveStableBranch({
      defaultBranch,
      localBranches,
      remoteBranches,
    })
  }

  const channel = determineChannel(resolvedBranch, stableBranch)

  return {
    target,
    resolvedBranch,
    channel,
    requiresReleaseTypePrompt: channel === 'custom',
    requiresCustomStableConfirm: false,
    isCurrentBranchTarget: resolvedBranch === currentBranch,
  }
}
