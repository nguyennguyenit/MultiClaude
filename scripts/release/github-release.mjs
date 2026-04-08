import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'

import { runCommand } from './run-command.mjs'
import { runGh, runGit } from './git-state.mjs'

const EXPECTED_ASSET_PATTERNS = [
  /\.AppImage$/,
  /\.deb$/,
  /\.dmg$/,
  /\.dmg\.blockmap$/,
  /\.zip$/,
  /\.zip\.blockmap$/,
  /\.exe$/,
  /\.exe\.blockmap$/,
  /^latest.*\.yml$/,
]

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export function selectWorkflowRun(runs, { tag, startedAt, tagSha }) {
  return runs.find(run => {
    if (run.event !== 'workflow_dispatch') {
      return false
    }

    if (tagSha && run.headSha && run.headSha !== tagSha) {
      return false
    }

    if (run.headBranch && run.headBranch !== tag) {
      return false
    }

    return Date.parse(run.createdAt) >= startedAt
  })
}

export async function createDraftRelease(cwd, { version, notes, prerelease }) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'multiclaude-release-'))
  const notesPath = path.join(tempDir, 'release-notes.md')

  try {
    await writeFile(notesPath, notes)

    const args = [
      'release',
      'create',
      `v${version}`,
      '--draft',
      '--title',
      `v${version}`,
      '--notes-file',
      notesPath,
    ]

    if (prerelease) {
      args.push('--prerelease')
    }

    const result = await runGh(cwd, args)
    return result.stdout
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function deleteDraftRelease(cwd, version) {
  const result = await runGh(cwd, ['release', 'delete', `v${version}`, '--yes'], {
    allowFailure: true,
  })
  return result.exitCode === 0
}

export async function dispatchReleaseWorkflow(cwd, version) {
  const tag = `v${version}`
  const startedAt = Date.now()
  const tagSha = (await runGit(cwd, ['rev-list', '-n', '1', tag])).stdout

  await runGh(cwd, ['workflow', 'run', 'release.yml', '--ref', tag, '-f', `tag=${tag}`])

  return {
    tag,
    startedAt,
    tagSha,
  }
}

export async function waitForWorkflowRun(
  cwd,
  { tag, startedAt, tagSha, timeoutMs = 15 * 60_000, pollMs = 5_000 }
) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const result = await runGh(cwd, [
      'run',
      'list',
      '--workflow',
      'release.yml',
      '--json',
      'databaseId,status,conclusion,url,event,headBranch,headSha,createdAt',
      '-L',
      '20',
    ])
    const runs = JSON.parse(result.stdout)
    const run = selectWorkflowRun(runs, { tag, startedAt, tagSha })

    if (run) {
      if (run.status === 'completed') {
        if (run.conclusion !== 'success') {
          throw new Error(`Release workflow failed for ${tag}: ${run.conclusion}. ${run.url}`)
        }

        return run
      }
    }

    await sleep(pollMs)
  }

  throw new Error(`Timed out waiting for the release workflow run for ${tag}.`)
}

export async function waitForReleaseAssets(cwd, { version, timeoutMs = 20 * 60_000, pollMs = 10_000 }) {
  const deadline = Date.now() + timeoutMs
  const tag = `v${version}`

  while (Date.now() < deadline) {
    const result = await runGh(cwd, [
      'release',
      'view',
      tag,
      '--json',
      'assets,isDraft,isPrerelease,url',
    ])
    const release = JSON.parse(result.stdout)
    const assetNames = release.assets.map(asset => asset.name)
    const missingPatterns = EXPECTED_ASSET_PATTERNS.filter(pattern =>
      !assetNames.some(name => pattern.test(name))
    )

    if (missingPatterns.length === 0) {
      return {
        url: release.url,
        isDraft: release.isDraft,
        isPrerelease: release.isPrerelease,
        assetNames,
      }
    }

    await sleep(pollMs)
  }

  throw new Error(`Timed out waiting for release assets for ${tag}.`)
}

export async function ensureReleaseExists(cwd, version) {
  await runCommand('gh', ['release', 'view', `v${version}`], { cwd })
}
