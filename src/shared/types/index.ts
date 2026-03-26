// Terminal types
export interface Terminal {
  id: string
  title: string
  cwd: string
  isClaudeMode: boolean
  claudeSessionId?: string
  projectId?: string
  createdAt: Date | string // Date in main process, ISO string in renderer (after IPC serialization)
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
  skipGitSetup?: boolean // Don't show git/github setup dialogs for this project
  createdAt: Date | string // Date in main process, ISO string in renderer (after IPC serialization)
  updatedAt: Date | string // Date in main process, ISO string in renderer (after IPC serialization)
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
  lastOutputAt?: number
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

export interface WindowState {
  isMaximized: boolean
  isFullScreen: boolean
  isExpanded: boolean
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
  status: 'added' | 'staged' | 'modified' | 'untracked' | 'deleted' | 'renamed' | 'copied'
  staged: boolean
  oldPath?: string
  additions?: number
  deletions?: number
}

export interface GitBranchDiffFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  oldPath?: string
  additions: number
  deletions: number
}

export interface GitBranchDiff {
  baseBranch: string
  files: GitBranchDiffFile[]
  aheadBy: number
  behindBy: number
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
export type ColorTheme =
  // Legacy themes (kept for backward compat - map to new themes on save)
  | 'default' | 'dusk' | 'lime' | 'ocean' | 'retro' | 'neo' | 'forest' | 'neon-cyber' | 'vibrant'
  // New VibeTerminal themes
  | 'tokyo-night' | 'catppuccin' | 'dracula' | 'rose-pine' | 'pro-dark'

// Terminal rendering mode: performance (no WebGL), balanced (WebGL for active only), quality (always WebGL)
export type TerminalRenderMode = 'performance' | 'balanced' | 'quality'

// UI Style types for Terminal/TUI mode
export type UiStyle = 'modern' | 'terminal'
export type TerminalColorPreset = 'green' | 'blue' | 'white'
export type TerminalFontId = 'system' | 'jetbrains-mono' | 'source-code-pro' | 'fira-code' | 'vt323' | 'ibm-plex-mono' | 'space-mono'
// App/UI font (non-terminal) - sans-serif fonts for the main interface
export type AppFontId = 'system' | 'inter' | 'geist' | 'plus-jakarta-sans' | 'roboto' | 'ubuntu' | 'segoe-ui'

export interface TerminalStyleOptions {
  colorPreset: TerminalColorPreset
  fontFamily: TerminalFontId
  useBorderChars: boolean
}

// WSL detection types (Windows only)
export interface WslDistro {
  name: string
  isDefault: boolean
}

export interface WslInfo {
  available: boolean
  distros: WslDistro[]
}

// Windows shell selection type
export type WindowsShell =
  | { type: 'cmd' }
  | { type: 'powershell' }
  | { type: 'wsl'; distro: string }

// Terminal limit types
export type TerminalLimitPreset = 2 | 4 | 9 | 'custom'
export interface TerminalLimit {
  preset: TerminalLimitPreset
  customValue?: number
}

// Activity Bar state (3 states: collapsed, expanded, hidden)
export type ActivityBarState = 'collapsed' | 'expanded' | 'hidden'

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
  colorTheme: ColorTheme
  terminalLimit: TerminalLimit
  terminalRenderMode: TerminalRenderMode
  glassmorphismEnabled: boolean
  // Terminal content font family (xterm)
  terminalFontFamily: TerminalFontId
  // Windows-only: default shell for new terminals
  windowsShell?: WindowsShell
  // Legacy fields - kept optional for backward compat with saved settings + hook
  themeMode?: ThemeMode
  // Main app/UI font family (non-terminal)
  modernFontFamily?: AppFontId
  // Legacy: UI style (terminal/modern toggle - removed in VibeTerminal reskin)
  uiStyle?: UiStyle
  terminalStyleOptions?: TerminalStyleOptions
  // Legacy: Activity Bar state (removed in VibeTerminal reskin)
  activityBarState?: ActivityBarState
  // Vietnamese IME fix settings
  vietnameseImeFix?: boolean
  vietnameseImeClaudeVersion?: string
  vietnameseImeClaudePath?: string
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
export * from './notification-events'

// Update types
export * from './update'
