import type {
  AppSettings,
  ColorTheme,
  ShellInfo,
  TerminalRendererPolicy,
  WindowsShell,
} from '@shared/types'
import { THEMES } from '@shared/constants'

export const CURRENT_SETTINGS_SCHEMA_VERSION = 2

const CURRENT_THEME_IDS = new Set(THEMES.map(theme => theme.id))

const LEGACY_THEME_MAP: Readonly<Record<string, ColorTheme>> = {
  default: 'tokyo-night',
  dusk: 'rose-pine',
  lime: 'catppuccin',
  ocean: 'tokyo-night',
  retro: 'dracula',
  neo: 'dracula',
  forest: 'catppuccin',
  'neon-cyber': 'tokyo-night',
  vibrant: 'rose-pine',
}

const TERMINAL_PRESET_THEME_MAP: Readonly<Record<string, ColorTheme>> = {
  green: 'catppuccin',
  blue: 'tokyo-night',
  white: 'pro-dark',
}

const RETIRED_KEYS = [
  'enableThinkingSyntaxHighlight',
  'glassmorphismEnabled',
  'activityBarState',
  'uiStyle',
  'terminalStyleOptions',
  'reflowSafeScrollback',
  'windowsShell',
  'terminalRenderMode',
  'gpuRendererForClaudeTerminals',
] as const

const TERMINAL_RENDERER_POLICIES: ReadonlySet<TerminalRendererPolicy> = new Set([
  'automatic',
  'prefer-gpu',
  'safe-dom',
])

function isTerminalRendererPolicy(value: unknown): value is TerminalRendererPolicy {
  return typeof value === 'string'
    && TERMINAL_RENDERER_POLICIES.has(value as TerminalRendererPolicy)
}

function migrateTerminalRendererPolicy(
  raw: Record<string, unknown>,
): TerminalRendererPolicy | undefined {
  const hasOwn = (key: string): boolean => Object.prototype.hasOwnProperty.call(raw, key)
  if (hasOwn('terminalRendererPolicy') && isTerminalRendererPolicy(raw.terminalRendererPolicy)) {
    return raw.terminalRendererPolicy
  }

  const schemaVersion = hasOwn('settingsSchemaVersion')
    ? raw.settingsSchemaVersion
    : undefined
  if (typeof schemaVersion === 'number' && schemaVersion >= 2) return undefined

  const legacyMode = hasOwn('terminalRenderMode') ? raw.terminalRenderMode : undefined
  const legacyGpuFlag = hasOwn('gpuRendererForClaudeTerminals')
    ? raw.gpuRendererForClaudeTerminals
    : undefined
  if (legacyMode === 'performance') return 'safe-dom'
  if (legacyGpuFlag === true) return 'prefer-gpu'
  if (legacyMode === 'quality') return 'prefer-gpu'
  if (legacyMode === 'balanced') return 'automatic'
  return undefined
}

function migrateWindowsShell(shell: unknown): ShellInfo | undefined {
  if (!shell || typeof shell !== 'object' || !('type' in shell)) return undefined

  const legacy = shell as WindowsShell
  if (legacy.type === 'cmd') {
    return { path: 'cmd.exe', name: 'Command Prompt', isDefault: true, kind: 'cmd' }
  }
  if (legacy.type === 'powershell') {
    return {
      path: 'powershell.exe',
      name: 'PowerShell',
      isDefault: true,
      kind: 'powershell',
    }
  }
  if (legacy.type === 'wsl' && typeof legacy.distro === 'string' && legacy.distro) {
    return {
      path: 'wsl.exe',
      name: legacy.distro,
      distro: legacy.distro,
      isDefault: true,
      kind: 'wsl',
    }
  }
  return undefined
}

/**
 * Pure, ordered settings migration. It intentionally accepts an unknown record
 * so hand-edited and old persisted payloads cross one main-owned boundary.
 */
export function migrateSettings(raw: Record<string, unknown>): Record<string, unknown> {
  const migrated = structuredClone(raw)
  const legacyStyle = migrated.terminalStyleOptions
  const terminalRendererPolicy = migrateTerminalRendererPolicy(raw)

  if (terminalRendererPolicy) {
    migrated.terminalRendererPolicy = terminalRendererPolicy
  }

  if (typeof migrated.colorTheme === 'string') {
    if (!CURRENT_THEME_IDS.has(migrated.colorTheme as ColorTheme)) {
      migrated.colorTheme = LEGACY_THEME_MAP[migrated.colorTheme] ?? 'tokyo-night'
    }
  } else if (
    migrated.uiStyle === 'terminal' &&
    legacyStyle &&
    typeof legacyStyle === 'object'
  ) {
    const preset = (legacyStyle as Record<string, unknown>).colorPreset
    migrated.colorTheme =
      typeof preset === 'string'
        ? TERMINAL_PRESET_THEME_MAP[preset] ?? 'tokyo-night'
        : 'tokyo-night'
  }

  if (legacyStyle && typeof legacyStyle === 'object') {
    const fontFamily = (legacyStyle as Record<string, unknown>).fontFamily
    if (typeof fontFamily === 'string' && migrated.terminalFontFamily === undefined) {
      migrated.terminalFontFamily = fontFamily
    }
  }

  if (migrated.defaultShell === undefined) {
    const defaultShell = migrateWindowsShell(migrated.windowsShell)
    if (defaultShell) migrated.defaultShell = defaultShell
  }

  for (const key of RETIRED_KEYS) {
    delete migrated[key]
  }
  migrated.settingsSchemaVersion = CURRENT_SETTINGS_SCHEMA_VERSION
  return migrated
}

export function migrateAppSettings(raw: Record<string, unknown>): Partial<AppSettings> {
  return migrateSettings(raw) as Partial<AppSettings>
}
