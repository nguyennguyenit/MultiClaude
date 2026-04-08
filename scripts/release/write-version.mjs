import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { runGit } from './git-state.mjs'

async function updateJsonVersion(filePath, version, updateRootPackage = false) {
  const original = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(original)
  let changed = false

  if (parsed.version !== version) {
    parsed.version = version
    changed = true
  }

  if (updateRootPackage && parsed.packages?.['']?.version !== version) {
    parsed.packages[''].version = version
    changed = true
  }

  if (changed) {
    await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`)
  }

  return changed
}

export async function writeVersionFiles(cwd, version) {
  const modifiedFiles = []
  const packageJsonPath = path.join(cwd, 'package.json')
  const packageLockPath = path.join(cwd, 'package-lock.json')

  if (await updateJsonVersion(packageJsonPath, version)) {
    modifiedFiles.push('package.json')
  }

  try {
    if (await updateJsonVersion(packageLockPath, version, true)) {
      modifiedFiles.push('package-lock.json')
    }
  } catch {
    // No lockfile update needed when the project does not use one.
  }

  return modifiedFiles
}

export async function createReleaseCommitAndTag(cwd, { version, modifiedFiles }) {
  if (modifiedFiles.length > 0) {
    await runGit(cwd, ['add', ...modifiedFiles])
    await runGit(cwd, ['commit', '-m', `chore(release): v${version}`])
  }

  await runGit(cwd, ['tag', `v${version}`])
}

export async function pushReleaseTag(cwd, version) {
  await runGit(cwd, ['push', 'origin', `v${version}`])
}

export async function pushReleaseBranch(cwd, branch) {
  await runGit(cwd, ['push', 'origin', branch])
}

export async function deleteLocalTag(cwd, version) {
  const result = await runGit(cwd, ['tag', '-d', `v${version}`], {
    allowFailure: true,
  })
  return result.exitCode === 0
}

export async function deleteRemoteTag(cwd, version) {
  const result = await runGit(cwd, ['push', 'origin', `:refs/tags/v${version}`], {
    allowFailure: true,
  })
  return result.exitCode === 0
}
