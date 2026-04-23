import fs from 'fs/promises'
import path from 'path'
import os from 'os'

/**
 * [RED-TEAM H1 decision] CLAUDE.md is NOT embedded verbatim in Claude Code's
 * JSONL transcript (verified 2026-04-23 by inspecting a live session file:
 * only a short `system/bridge_status` line appears, plus `attachment`
 * entries like `skill_listing` and `task_reminder`). The canonical CLAUDE.md
 * body is therefore read directly from disk at session start.
 *
 * Accepted risk: if the user edits CLAUDE.md after Claude Code captured it
 * at session start, our bucket count drifts from Claude's actual view. For
 * MVP observability this drift is acceptable.
 */

export interface ClaudeMdContent {
  /** Concatenated "global\n\nproject" text (either half may be empty). */
  text: string
  /** Byte length of `text`. */
  bytes: number
  /** Files actually read (for diagnostics). */
  sources: string[]
}

export class ClaudeMdReader {
  async load(cwd: string | undefined): Promise<ClaudeMdContent> {
    const paths: string[] = []
    const globalPath = path.join(os.homedir(), '.claude', 'CLAUDE.md')
    paths.push(globalPath)
    if (cwd) paths.push(path.join(cwd, 'CLAUDE.md'))

    const parts: string[] = []
    const sources: string[] = []
    for (const p of paths) {
      try {
        const body = await fs.readFile(p, 'utf8')
        parts.push(body)
        sources.push(p)
      } catch {
        // ENOENT / EACCES → skip silently
      }
    }

    const text = parts.join('\n\n')
    return {
      text,
      bytes: Buffer.byteLength(text, 'utf8'),
      sources
    }
  }
}
