import {
  checkGhAuth,
  isWorkingTreeClean,
  readBranchSets,
  readCurrentBranch,
  readDefaultBranch,
  readPackageVersion,
  readVersionTags,
  releaseExists,
  tagExists,
} from './git-state.mjs'
import { resolveReleaseTarget } from './resolve-target.mjs'
import {
  buildVersionPlan,
  collectLatestVersions,
  detectDuplicateVersion,
  normalizeReleaseVersion,
} from './versioning.mjs'

export async function buildReleaseContext(cwd, { target, version, releaseType }) {
  const [currentBranch, branchSets, defaultBranch, tags, cleanTree, ghAuth] = await Promise.all([
    readCurrentBranch(cwd),
    readBranchSets(cwd),
    readDefaultBranch(cwd),
    readVersionTags(cwd),
    isWorkingTreeClean(cwd),
    checkGhAuth(cwd),
  ])
  const targetState = resolveReleaseTarget({
    target,
    currentBranch,
    defaultBranch,
    localBranches: branchSets.localBranches,
    remoteBranches: branchSets.remoteBranches,
  })
  const currentVersion = await readPackageVersion(cwd, targetState.resolvedBranch)
  const { latestStable, latestBeta } = collectLatestVersions(tags)
  const versionPlan = buildVersionPlan({
    channel: targetState.channel,
    currentVersion,
    latestStable,
    latestBeta,
  })
  const selectedVersion = version ? normalizeReleaseVersion(version) : versionPlan.suggestedVersion
  const selectedReleaseType = releaseType ?? versionPlan.defaultReleaseType
  const requiresVersionPrompt = version ? false : versionPlan.requiresVersionPrompt
  const requiresReleaseTypePrompt = Boolean(targetState.requiresReleaseTypePrompt && !releaseType)
  const requiresCustomStableConfirm =
    targetState.channel === 'custom' && selectedReleaseType === 'stable'
  let duplicateState = {
    duplicateTag: false,
    duplicateRelease: false,
    hasDuplicate: false,
  }

  if (selectedVersion) {
    const duplicateTag = await tagExists(cwd, selectedVersion)
    const duplicateRelease = ghAuth.isValid
      ? await releaseExists(cwd, selectedVersion)
      : false

    duplicateState = detectDuplicateVersion({
      version: selectedVersion,
      tagExists: duplicateTag,
      releaseExists: duplicateRelease,
    })
  }

  return {
    branchSets,
    currentBranch,
    currentVersion,
    defaultBranch,
    ghAuth,
    latestBeta,
    latestStable,
    releaseType: selectedReleaseType,
    requestedVersion: selectedVersion,
    requiresBranchSwitch: targetState.resolvedBranch !== currentBranch,
    requiresCustomStableConfirm,
    requiresReleaseTypePrompt,
    requiresVersionPrompt,
    resolvedTarget: targetState,
    versionPlan,
    cleanTree,
    duplicateState,
  }
}

export function toPreviewJson(context) {
  return {
    target: context.resolvedTarget.target,
    resolvedBranch: context.resolvedTarget.resolvedBranch,
    stableBranch: context.defaultBranch,
    channel: context.resolvedTarget.channel,
    currentBranch: context.currentBranch,
    currentVersion: context.currentVersion,
    latestStable: context.latestStable,
    latestBeta: context.latestBeta,
    suggestedVersion: context.versionPlan.suggestedVersion,
    requestedVersion: context.requestedVersion,
    releaseType: context.releaseType,
    requiresVersionPrompt: context.requiresVersionPrompt,
    requiresReleaseTypePrompt: context.requiresReleaseTypePrompt,
    requiresCustomStableConfirm: context.requiresCustomStableConfirm,
    requiresBranchSwitch: context.requiresBranchSwitch,
    preflight: {
      ghAuthValid: context.ghAuth.isValid,
      ghAuthMessage: context.ghAuth.details,
      cleanTree: context.cleanTree,
      duplicateTag: context.duplicateState.duplicateTag,
      duplicateRelease: context.duplicateState.duplicateRelease,
    },
  }
}
