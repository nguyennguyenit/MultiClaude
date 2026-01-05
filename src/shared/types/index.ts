// Terminal types
export interface Terminal {
  id: string
  title: string
  cwd: string
  isClaudeMode: boolean
  claudeSessionId?: string
  projectId?: string
  createdAt: Date
  // Allow OSC title updates only after activity starts (e.g., Claude mode)
  allowTitleUpdate?: boolean
}

export interface TerminalState {
  terminals: Map<string, Terminal>
  activeTerminalId: string | null
}

export interface TerminalOutput {
  terminalId: string
  data: string
}

// Project types
export interface Project {
  id: string
  name: string
  path: string
  gitRemote?: string
  createdAt: Date
  updatedAt: Date
}

export interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
}

// Session types
export interface TerminalSession {
  id: string
  title: string
  cwd: string
  projectId?: string
  claudeSessionId?: string
  outputBuffer: string
}

// Per-project terminal layout types
export interface ProjectTerminalLayout {
  projectId: string
  terminals: ProjectTerminal[]
}

export interface ProjectTerminal {
  id: string
  title: string
  position: number // 0-8 for grid position
}

export interface AppSession {
  terminals: TerminalSession[]
  activeTerminalId: string | null
  windowBounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

// Git types
export interface GitStatus {
  isRepo: boolean
  branch?: string
  hasRemote: boolean
  remoteName?: string
  remoteUrl?: string
  isDirty: boolean
  staged: number
  unstaged: number
  untracked: number
}

export interface GitHubAuth {
  isAuthenticated: boolean
  username?: string
}

export interface GitConfig {
  userName?: string
  userEmail?: string
}

// Git file status for commit workflow panel
export interface GitFileStatus {
  path: string
  status: 'staged' | 'modified' | 'untracked' | 'deleted' | 'renamed' | 'copied'
  staged: boolean
  oldPath?: string
}

export interface GitCommitResult {
  success: boolean
  hash?: string
  error?: string
}

export interface GitDiffResult {
  success: boolean
  diff?: string
  error?: string
}

// New Git types for extended features
export interface GitBranch {
  name: string
  current: boolean
  commit: string
  label: string
  isRemote: boolean
}

export interface GitLogEntry {
  hash: string
  hashShort: string
  author: string
  email: string
  date: string
  message: string
}

export interface GitStashEntry {
  index: number
  hash: string
  message: string
  date: string
}

export interface GitOperationResult {
  success: boolean
  message?: string
  error?: string
}

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system'
export type ColorTheme = 'default' | 'dusk' | 'lime' | 'ocean' | 'retro' | 'neo' | 'forest'

// Terminal limit types
export type TerminalLimitPreset = 2 | 4 | 9 | 'custom'
export interface TerminalLimit {
  preset: TerminalLimitPreset
  customValue?: number
}

export interface ThemePreviewColors {
  bg: string
  accent: string
  darkBg: string
  darkAccent?: string
}

export interface ColorThemeDefinition {
  id: ColorTheme
  name: string
  description: string
  previewColors: ThemePreviewColors
}

export interface AppSettings {
  themeMode: ThemeMode
  colorTheme: ColorTheme
  terminalLimit: TerminalLimit
}

// GitHub Issues/PRs types
export interface GitHubIssue {
  number: number
  title: string
  state: 'open' | 'closed'
  createdAt: string
  author: { login: string }
  labels: { name: string; color: string }[]
  body?: string
}

export interface GitHubPR {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  createdAt: string
  author: { login: string }
  headRefName: string
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
}

// Notification types
export * from './notification'
