import fs from 'node:fs'
import path from 'node:path'

export function packagedExecutableCandidates(platform, releaseDir = path.resolve('release')) {
  if (platform === 'darwin') {
    return [
      path.join(releaseDir, 'mac-arm64', 'MultiClaude.app', 'Contents', 'MacOS', 'MultiClaude'),
      path.join(releaseDir, 'mac', 'MultiClaude.app', 'Contents', 'MacOS', 'MultiClaude'),
      path.join(releaseDir, 'mac-universal', 'MultiClaude.app', 'Contents', 'MacOS', 'MultiClaude'),
    ]
  }
  if (platform === 'win32') return [path.join(releaseDir, 'win-unpacked', 'MultiClaude.exe')]
  if (platform === 'linux') return [path.join(releaseDir, 'linux-unpacked', 'multiclaude')]
  throw new Error(`Unsupported packaged-smoke platform: ${platform}`)
}

export function resolvePackagedExecutable(platform, releaseDir) {
  const candidates = packagedExecutableCandidates(platform, releaseDir)
  const executable = candidates.find(candidate => fs.existsSync(candidate))
  if (!executable) throw new Error(`Packaged executable not found. Checked: ${candidates.join(', ')}`)
  return executable
}
