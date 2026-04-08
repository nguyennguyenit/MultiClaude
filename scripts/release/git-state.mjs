import { readFile } from 'node:fs/promises'

import { runCommand } from './run-command.mjs'

export function parseDefaultBranchSymbolicRef(stdout) {
  const value = stdout.trim()

  if (!value) {
    return null
  }

  const parts = value.split('/')
  return parts[parts.length - 1] || null
}

function parseLines(stdout) {
  return new Set(
    stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  )
}

async function runGit(cwd, args, options) {
  return runCommand('git', args, { cwd, ...options })
}

async function runGh(cwd, args, options) {
  return runCommand('gh', args, { cwd, ...options })
}

export async function readCurrentBranch(cwd) {
  const result = await runGit(cwd, ['branch', '--show-current'])
  return result.stdout
}

export async function readRepoRoot(cwd) {
  const result = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  return result.stdout
}

export async function readBranchSets(cwd) {
  const [localResult, remoteResult] = await Promise.all([
    runGit(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']),
    runGit(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin']),
  ])

  return {
    localBranches: parseLines(localResult.stdout),
    remoteBranches: parseLines(remoteResult.stdout),
  }
}

export async function readDefaultBranch(cwd) {
  const symbolicRef = await runGit(
    cwd,
    ['symbolic-ref', 'refs/remotes/origin/HEAD'],
    { allowFailure: true }
  )

  const symbolicBranch = parseDefaultBranchSymbolicRef(symbolicRef.stdout)

  if (symbolicBranch) {
    return symbolicBranch
  }

  const repoView = await runGh(
    cwd,
    ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'],
    { allowFailure: true }
  )

  if (repoView.exitCode === 0 && repoView.stdout) {
    return repoView.stdout.trim()
  }

  const { localBranches, remoteBranches } = await readBranchSets(cwd)
  const branchCandidates = ['main', 'master']

  for (const branchCandidate of branchCandidates) {
    if (
      localBranches.has(branchCandidate) ||
      remoteBranches.has(`origin/${branchCandidate}`)
    ) {
      return branchCandidate
    }
  }

  return null
}

export async function readVersionTags(cwd) {
  const result = await runGit(cwd, ['tag', '--list', 'v*', '--sort=version:refname'])
  return [...parseLines(result.stdout)]
}

export async function isWorkingTreeClean(cwd) {
  const result = await runGit(cwd, ['status', '--short'])
  return result.stdout.length === 0
}

export async function checkGhAuth(cwd) {
  const result = await runGh(cwd, ['auth', 'status'], { allowFailure: true })
  return {
    isValid: result.exitCode === 0,
    details: result.stdout || result.stderr,
  }
}

export async function tagExists(cwd, version) {
  const result = await runGit(
    cwd,
    ['rev-parse', '--verify', '--quiet', `refs/tags/v${version}`],
    { allowFailure: true }
  )
  return result.exitCode === 0
}

export async function releaseExists(cwd, version) {
  const result = await runGh(cwd, ['release', 'view', `v${version}`], {
    allowFailure: true,
  })
  return result.exitCode === 0
}

export async function readPackageVersion(cwd, ref = null) {
  if (!ref) {
    const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
    return packageJson.version
  }

  const result = await runGit(cwd, ['show', `${ref}:package.json`], {
    allowFailure: true,
  })

  if (result.exitCode !== 0 || !result.stdout) {
    const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
    return packageJson.version
  }

  return JSON.parse(result.stdout).version
}

export async function checkoutBranch(cwd, branch, localBranches) {
  if (localBranches.has(branch)) {
    await runGit(cwd, ['switch', branch])
    return
  }

  await runGit(cwd, ['switch', '--track', '-c', branch, `origin/${branch}`])
}

export async function readCommitSubjects(cwd, range) {
  const args = range
    ? ['log', '--format=%H%x09%s', range]
    : ['log', '--format=%H%x09%s']
  const result = await runGit(cwd, args)

  return result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [hash, subject] = line.split('\t')
      return { hash, subject }
    })
}

export { runGh, runGit }
