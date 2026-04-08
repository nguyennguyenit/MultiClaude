import { buildReleaseNotes } from './release-notes.mjs'
import { checkoutBranch, readCommitSubjects } from './git-state.mjs'
import {
  createDraftRelease,
  deleteDraftRelease,
  dispatchReleaseWorkflow,
  waitForReleaseAssets,
  waitForWorkflowRun,
} from './github-release.mjs'
import { buildReleaseContext } from './release-context.mjs'
import {
  createReleaseCommitAndTag,
  deleteLocalTag,
  deleteRemoteTag,
  pushReleaseBranch,
  pushReleaseTag,
  writeVersionFiles,
} from './write-version.mjs'

function determinePreviousTag({ version, releaseType, latestStable, latestBeta }) {
  if (releaseType === 'stable') {
    return latestStable ? `v${latestStable}` : null
  }

  if (version.includes('-beta.')) {
    return latestBeta ? `v${latestBeta}` : latestStable ? `v${latestStable}` : null
  }

  return latestStable ? `v${latestStable}` : latestBeta ? `v${latestBeta}` : null
}

export async function executeRelease(cwd, flags) {
  const releaseType = flags['release-type']
  const context = await buildReleaseContext(cwd, {
    target: flags.target,
    version: flags.version,
    releaseType,
  })
  const blockers = []

  if (!context.ghAuth.isValid) {
    blockers.push(context.ghAuth.details || 'GitHub CLI auth is invalid.')
  }

  if (!context.cleanTree) {
    blockers.push('Release execution requires a clean working tree.')
  }

  if (context.duplicateState.hasDuplicate) {
    blockers.push(`Release version ${context.requestedVersion} already exists as a tag or release.`)
  }

  if (context.requiresCustomStableConfirm && !flags['confirm-custom-stable']) {
    blockers.push('Stable releases from custom branches require --confirm-custom-stable.')
  }

  if (blockers.length > 0) {
    throw new Error(blockers.join('\n\n'))
  }

  if (context.requiresBranchSwitch) {
    await checkoutBranch(
      cwd,
      context.resolvedTarget.resolvedBranch,
      context.branchSets.localBranches
    )
  }

  const previousTag = determinePreviousTag({
    version: context.requestedVersion,
    releaseType,
    latestStable: context.latestStable,
    latestBeta: context.latestBeta,
  })
  const commits = await readCommitSubjects(
    cwd,
    previousTag ? `${previousTag}..HEAD` : null
  )
  const releaseNotes = buildReleaseNotes({
    version: context.requestedVersion,
    commits,
  })
  const modifiedFiles = await writeVersionFiles(cwd, context.requestedVersion)
  let tagCreated = false
  let remoteTagCreated = false
  let draftCreated = false
  let workflowRun = null
  let assets = null

  try {
    await createReleaseCommitAndTag(cwd, {
      version: context.requestedVersion,
      modifiedFiles,
    })
    tagCreated = true

    await pushReleaseTag(cwd, context.requestedVersion)
    remoteTagCreated = true

    await createDraftRelease(cwd, {
      version: context.requestedVersion,
      notes: releaseNotes,
      prerelease: releaseType === 'prerelease',
    })
    draftCreated = true

    const workflowDispatch = await dispatchReleaseWorkflow(cwd, context.requestedVersion)
    workflowRun = await waitForWorkflowRun(cwd, workflowDispatch)
    assets = await waitForReleaseAssets(cwd, {
      version: context.requestedVersion,
    })
  } catch (error) {
    const rollbackSteps = []

    if (draftCreated && (await deleteDraftRelease(cwd, context.requestedVersion))) {
      rollbackSteps.push('deleted draft release')
    }

    if (remoteTagCreated && (await deleteRemoteTag(cwd, context.requestedVersion))) {
      rollbackSteps.push('deleted remote tag')
    }

    if (tagCreated && (await deleteLocalTag(cwd, context.requestedVersion))) {
      rollbackSteps.push('deleted local tag')
    }

    const rollbackMessage =
      rollbackSteps.length > 0
        ? `\n\nRollback: ${rollbackSteps.join(', ')}.`
        : ''

    throw new Error(`${error.message}${rollbackMessage}`)
  }

  let branchPushWarning = null

  try {
    await pushReleaseBranch(cwd, context.resolvedTarget.resolvedBranch)
  } catch (error) {
    branchPushWarning = error.message
  }

  return {
    status: 'draft-ready',
    branch: context.resolvedTarget.resolvedBranch,
    tag: `v${context.requestedVersion}`,
    version: context.requestedVersion,
    releaseType,
    workflowRunUrl: workflowRun.url,
    releaseUrl: assets.url,
    assetNames: assets.assetNames,
    isDraft: assets.isDraft,
    isPrerelease: assets.isPrerelease,
    branchPushWarning,
  }
}
