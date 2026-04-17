/**
 * Quote terminal paths containing whitespace or shell-special characters.
 */
export function formatPathForTerminal(path: string): string {
  if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(path)) {
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
}

/** Backslash-escape every shell-special character instead of wrapping
 *  the path in quotes. Required for Claude Code v2.1.112 — a quoted
 *  path triggers its auto-attach path, which hides the path from the
 *  prompt and shows a `[Image N]` indicator below the status bar
 *  instead. Backslash-escaped paths read to Claude as "typed" input
 *  and render inline in the prompt where the user expects them. */
export function backslashEscapePathForTerminal(path: string): string {
  return path.replace(/[\s"'`$\\!&|;<>(){}[\]*?#~]/g, '\\$&')
}

/**
 * Join file paths into a single terminal input string.
 */
export function joinPathsForTerminal(paths: string[]): string {
  return paths
    .filter(Boolean)
    .map(formatPathForTerminal)
    .join(' ')
}

/** Like `joinPathsForTerminal` but uses backslash-escape — Claude-mode
 *  drops/pastes use this to keep paths visible inline in Claude's prompt
 *  instead of triggering its quoted-path auto-attach handler. */
export function joinPathsForClaudeTerminal(paths: string[]): string {
  return paths
    .filter(Boolean)
    .map(backslashEscapePathForTerminal)
    .join(' ')
}
