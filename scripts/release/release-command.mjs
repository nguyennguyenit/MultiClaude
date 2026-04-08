#!/usr/bin/env node

import { executeRelease as runReleaseExecution } from './execute-release.mjs'
import { readRepoRoot } from './git-state.mjs'
import { buildReleaseContext, toPreviewJson } from './release-context.mjs'
import { isValidReleaseVersion } from './versioning.mjs'

function parseArgs(argv) {
  const [command, ...rest] = argv
  const parsed = { command, flags: {} }

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}".`)
    }

    const flagName = token.slice(2)
    const nextToken = rest[index + 1]

    if (!nextToken || nextToken.startsWith('--')) {
      parsed.flags[flagName] = true
      continue
    }

    parsed.flags[flagName] = nextToken
    index += 1
  }

  return parsed
}

async function previewRelease(cwd, flags) {
  if (!flags.target || typeof flags.target !== 'string') {
    throw new Error('preview requires --target <branch|current|main|beta>.')
  }

  const context = await buildReleaseContext(cwd, {
    target: flags.target,
    version: typeof flags.version === 'string' ? flags.version : null,
    releaseType: typeof flags['release-type'] === 'string' ? flags['release-type'] : null,
  })

  console.log(JSON.stringify(toPreviewJson(context), null, 2))
}

async function runExecuteCommand(cwd, flags) {
  if (!flags.confirm) {
    throw new Error('execute requires --confirm after the final human approval.')
  }

  if (!flags.target || !flags.version || !flags['release-type']) {
    throw new Error(
      'execute requires --target <...> --version <semver> --release-type <stable|prerelease>.'
    )
  }

  const releaseType = flags['release-type']

  if (releaseType !== 'stable' && releaseType !== 'prerelease') {
    throw new Error('release type must be either "stable" or "prerelease".')
  }

  if (!isValidReleaseVersion(flags.version)) {
    throw new Error(`Invalid release version "${flags.version}".`)
  }
  const result = await runReleaseExecution(cwd, flags)
  console.log(JSON.stringify(result, null, 2))
}

async function main() {
  const cwd = await readRepoRoot(process.cwd())
  const parsed = parseArgs(process.argv.slice(2))

  if (parsed.command === 'preview') {
    await previewRelease(cwd, parsed.flags)
    return
  }

  if (parsed.command === 'execute') {
    await runExecuteCommand(cwd, parsed.flags)
    return
  }

  throw new Error('Usage: node scripts/release/release-command.mjs <preview|execute> [flags]')
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
