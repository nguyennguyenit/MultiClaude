import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const rendererRoot = path.resolve(__dirname)
const outputListenerPattern = 'window.electron.terminal.onOutput'

function collectRendererFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry)
    const entryStat = statSync(entryPath)

    if (entryStat.isDirectory()) {
      return collectRendererFiles(entryPath)
    }

    return /\.(ts|tsx)$/.test(entryPath) && !/\.spec\.(ts|tsx)$/.test(entryPath) ? [entryPath] : []
  })
}

describe('renderer terminal output listener invariant', () => {
  it('keeps a single renderer onOutput subscription in App.tsx', () => {
    const matches = collectRendererFiles(rendererRoot).flatMap((filePath) => {
      const fileContent = readFileSync(filePath, 'utf8')
      return fileContent.includes(outputListenerPattern) ? [path.relative(rendererRoot, filePath)] : []
    })

    expect(matches).toEqual(['App.tsx'])
  })
})
