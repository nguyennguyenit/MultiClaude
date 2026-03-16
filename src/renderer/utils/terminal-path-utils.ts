/**
 * Quote terminal paths containing whitespace or shell-special characters.
 */
export function formatPathForTerminal(path: string): string {
  if (/[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(path)) {
    return `"${path.replace(/"/g, '\\"')}"`
  }
  return path
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
