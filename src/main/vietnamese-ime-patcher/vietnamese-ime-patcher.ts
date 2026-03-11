import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'fs'
import { platform } from 'os'
import { join } from 'path'

const DORK = '/* _0x0a0d_ime_fix_ */'

export interface PatchResult {
  success: boolean
  alreadyPatched?: boolean
  message?: string
  claudePath?: string
  claudeVersion?: string
}

// Run shell command safely, return trimmed first line or empty string
function run(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split(/\r?\n/)[0]
      .trim()
  } catch {
    return ''
  }
}

/** Find Claude Code binary path by checking common install locations */
export function findClaudePath(): string | null {
  const isWin = platform() === 'win32'

  // 1) which / where
  for (const cmd of [isWin ? 'where claude' : 'which claude', 'bun which claude']) {
    const p = run(cmd)
    if (p && existsSync(p)) {
      if (!isWin) {
        try {
          return execSync(`realpath "${p}"`).toString().trim()
        } catch { /* fallthrough */ }
      }
      return p
    }
  }

  // 2) Bun global paths
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const bunInstall = process.env.BUN_INSTALL || join(home, '.bun')
  const bunPaths = [
    join(bunInstall, 'bin', isWin ? 'claude.exe' : 'claude'),
    join(bunInstall, 'install', 'global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
  ]
  for (const p of bunPaths) {
    if (existsSync(p)) return p
  }

  // 3) npm global
  try {
    const npmRoot = execSync('npm root -g').toString().trim()
    const cliPath = join(npmRoot, '@anthropic-ai', 'claude-code', 'cli.js')
    if (existsSync(cliPath)) return cliPath
  } catch { /* ignore */ }

  // 4) Windows-specific fallbacks
  if (isWin) {
    const winPaths = [
      join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
      join(process.env.LOCALAPPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    ]
    for (const p of winPaths) {
      if (existsSync(p)) return p
    }
  }

  return null
}

/** Get Claude Code version by running `claude --version` */
export function getClaudeVersion(): string | null {
  const output = run('claude --version')
  if (!output) return null
  // Extract version number (e.g. "2.1.72" from "claude 2.1.72" or just "2.1.72")
  const match = output.match(/(\d+\.\d+\.\d+)/)
  return match ? match[1] : output
}

// Patch JS source content (npm installs)
function patchContentJs(content: string): PatchResult {
  if (content.includes(DORK)) {
    return { success: true, alreadyPatched: true }
  }

  const re = /(?<m0>(?<var0>[\w$]+)\.match\(\/\\x7f\/g\).*?)(?<m1>if\(!(?<var1>[\w$]+)\.equals\((?<var2>[\w$]+)\)\){if\(\k<var1>\.text!==\k<var2>\.text\)(?<func1>[\w$]+)\(\k<var2>\.text\);(?<func2>[\w$]+)\(\k<var2>\.offset\)})(?<m2>(?:[\w$]+\(\),?\s*)*;?\s*return)/g

  const newContent = content.replace(re, (...args: unknown[]) => {
    const groups = args[args.length - 1] as Record<string, string>
    const { m0, m1, var0, var2, m2 } = groups
    return `
${DORK}
${m0}
let _vn = ${var0}.replace(/\\x7f/g, "");
if (_vn.length > 0) {
    for (const _c of _vn) ${var2} = ${var2}.insert(_c);
    ${m1}
}
${m2}
`
  })

  if (newContent.length === content.length) {
    return { success: false, message: 'Patch regex did not match - Claude version may be unsupported' }
  }

  return { success: true, alreadyPatched: false, content: newContent } as PatchResult & { content: string }
}

// Patch compiled binary content (curl installs - Bun compiled)
function patchContentBinary(binaryContent: string): PatchResult & { content?: string } {
  if (binaryContent.includes(DORK)) {
    return { success: true, alreadyPatched: true }
  }

  const re = /(?<m0>(?<var0>[\w$]+)\.match\(\/\\x7f\/g\).*?)(?<m1>if\(!(?<var1>[\w$]+)\.equals\((?<var2>[\w$]+)\)\){if\(\k<var1>\.text!==\k<var2>\.text\)(?<func1>[\w$]+)\(\k<var2>\.text\);(?<func2>[\w$]+)\(\k<var2>\.offset\)})(?<m2>(?:[\w$]+\(\),?\s*)*;?\s*return)/g

  const matches: { diff: number; index: number; found?: boolean }[] = []
  binaryContent = binaryContent.replace(re, (...args: unknown[]) => {
    const groups = args[args.length - 1] as Record<string, string>
    const offset = args[args.length - 3] as number
    const original = args[0] as string
    const { m0, m1, var0, var2, m2 } = groups

    const patchedContent = `${DORK}
${m0}
let _vn = ${var0}.replace(/\\x7f/g, "");
if (_vn.length > 0) {
    for (const _c of _vn) ${var2} = ${var2}.insert(_c);
    ${m1}
}
${m2}`.replace(/^\s+/gm, '')
    matches.push({ diff: patchedContent.length - original.length, index: offset })
    return patchedContent
  })

  if (matches.length === 0) {
    return { success: false, message: 'Patch regex did not match - Claude version may be unsupported' }
  }

  // Adjust Bun pragma offsets to maintain valid binary
  const pragma = '// @bun '
  const pragmaLength = pragma.length
  for (let i = 0; i < matches.length; i++) {
    for (let j = matches[i].index - 1; j >= (i === 0 ? 0 : matches[i - 1].index); j--) {
      if (binaryContent[j] === '\x00') {
        if (binaryContent.slice(j + 1, j + 1 + pragmaLength) === pragma) {
          let found = false
          for (let k = j + 1 + pragmaLength; k < matches[i].index; k++) {
            if (binaryContent[k] === '\n' && binaryContent[k + 1] === '/' && binaryContent[k + 2] === '/') {
              const diff = matches[i].diff
              const sliceStart = k + 3
              binaryContent = binaryContent.slice(0, sliceStart) + binaryContent.slice(sliceStart + diff)
              found = true
              break
            }
          }
          if (found) {
            matches[i].found = true
            break
          }
        }
      }
    }
    if (!matches[i].found) break
  }

  if (matches.every(m => !m.found)) {
    return { success: false, message: 'Patch failed: could not adjust binary pragma offsets' }
  }

  return { success: true, alreadyPatched: false, content: binaryContent }
}

/**
 * Apply Vietnamese IME fix patch to Claude Code binary.
 * Creates backup before patching, validates after, rolls back on failure.
 */
export function applyVietnameseImePatch(customPath?: string): PatchResult {
  // 1. Find Claude path
  const claudePath = customPath || findClaudePath()
  if (!claudePath || !existsSync(claudePath)) {
    return {
      success: false,
      message: claudePath
        ? `Claude binary not found at: ${claudePath}`
        : 'Claude Code not found. Install it first or specify a custom path.'
    }
  }

  // 2. Read binary with latin1 encoding (binary-safe)
  let content: string
  try {
    content = readFileSync(claudePath, 'latin1')
  } catch (err) {
    return { success: false, message: `Cannot read Claude binary: ${(err as Error).message}` }
  }

  // 3. Detect JS vs binary and apply appropriate patch
  const isJs = claudePath.endsWith('.js')
  const result = isJs ? patchContentJs(content) : patchContentBinary(content)

  if (result.alreadyPatched) {
    const version = getClaudeVersion()
    return { success: true, alreadyPatched: true, claudePath, claudeVersion: version ?? undefined }
  }

  const patchedContent = (result as unknown as { content?: string }).content
  if (!result.success || !patchedContent) {
    return { ...result, claudePath }
  }

  // 4. Backup original
  const backupPath = `${claudePath}.ime-backup`
  try {
    copyFileSync(claudePath, backupPath)
  } catch (err) {
    return { success: false, message: `Cannot create backup: ${(err as Error).message}`, claudePath }
  }

  // 5. Write patched content
  try {
    writeFileSync(claudePath, patchedContent, 'latin1')
  } catch (err) {
    return { success: false, message: `Cannot write patched binary: ${(err as Error).message}`, claudePath }
  }

  // 6. Validate: run claude --version to verify binary still works
  const version = getClaudeVersion()
  if (!version) {
    // Rollback on validation failure
    console.error('[vietnamese-ime-patcher] Validation failed, rolling back...')
    try {
      copyFileSync(backupPath, claudePath)
      unlinkSync(backupPath)
    } catch { /* best effort rollback */ }
    return { success: false, message: 'Patch validation failed - binary may be corrupted. Restored backup.', claudePath }
  }

  // 7. Cleanup backup on success
  try { unlinkSync(backupPath) } catch { /* ignore */ }

  return { success: true, alreadyPatched: false, claudePath, claudeVersion: version }
}
