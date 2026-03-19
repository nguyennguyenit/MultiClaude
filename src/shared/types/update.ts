export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error'
export type UpdateInstallMode = 'auto-install' | 'open-installer'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  downloadProgress: number // 0-100
  error: string | null
  installMode: UpdateInstallMode
}
