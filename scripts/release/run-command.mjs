import { spawn } from 'node:child_process'

export function runCommand(command, args, { cwd, input = null, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += chunk
    })

    child.stderr.on('data', chunk => {
      stderr += chunk
    })

    child.on('error', reject)
    child.on('close', exitCode => {
      const result = {
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      }

      if (!allowFailure && exitCode !== 0) {
        const error = new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${exitCode}`)
        error.result = result
        reject(error)
        return
      }

      resolve(result)
    })

    if (input != null) {
      child.stdin.write(input)
    }

    child.stdin.end()
  })
}
