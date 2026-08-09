import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** Build the exact Electron bundle that every E2E worker launches. */
export default function globalSetup(): void {
  const e2eDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(e2eDir, '../../..')
  const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

  execFileSync(process.execPath, [viteBin, 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
}
