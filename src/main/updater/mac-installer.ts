import type { UpdateInstallMode } from '@shared/types'

export interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
  size?: number
}

function hasToken(value: string, tokens: string[]) {
  const normalized = value.toLowerCase()
  return tokens.some(token => normalized.includes(token))
}

function isArm64Asset(name: string) {
  return hasToken(name, ['arm64', 'aarch64'])
}

function isX64Asset(name: string) {
  return hasToken(name, ['x64', 'amd64'])
}

function isUniversalAsset(name: string) {
  return name.toLowerCase().includes('universal')
}

function scoreMacDmgAsset(name: string, arch: string) {
  let score = 0

  if (arch === 'arm64') {
    if (isArm64Asset(name)) score += 100
    if (isX64Asset(name)) score -= 100
  } else {
    if (isX64Asset(name)) score += 100
    if (isArm64Asset(name)) score -= 100
  }

  if (isUniversalAsset(name)) {
    score += 50
  }

  return score
}

export function pickMacDmgAsset(assets: GitHubReleaseAsset[], arch = process.arch): GitHubReleaseAsset | null {
  const dmgAssets = assets.filter(asset => asset.name.toLowerCase().endsWith('.dmg'))
  if (dmgAssets.length === 0) {
    return null
  }

  return [...dmgAssets].sort((a, b) => scoreMacDmgAsset(b.name, arch) - scoreMacDmgAsset(a.name, arch))[0] ?? null
}

export function getUpdateInstallMode(platform = process.platform): UpdateInstallMode {
  return platform === 'darwin' ? 'open-installer' : 'auto-install'
}
