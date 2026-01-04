import { IpcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { IPC_CHANNELS } from '@shared/constants'

const execAsync = promisify(exec)

// Allowed states to prevent command injection
const VALID_ISSUE_STATES = ['open', 'closed', 'all'] as const
const VALID_PR_STATES = ['open', 'closed', 'merged', 'all'] as const

export function registerGitHubHandlers(ipcMain: IpcMain) {
  // List GitHub issues
  ipcMain.handle(IPC_CHANNELS.GITHUB_ISSUES_LIST, async (_, projectPath: string, state = 'open') => {
    // Validate state to prevent command injection
    const validState = VALID_ISSUE_STATES.includes(state as typeof VALID_ISSUE_STATES[number])
      ? state
      : 'open'

    try {
      const { stdout } = await execAsync(
        `gh issue list --state ${validState} --json number,title,state,createdAt,author,labels --limit 100`,
        { cwd: projectPath }
      )
      return { success: true, data: JSON.parse(stdout || '[]') }
    } catch (error) {
      return { success: false, error: (error as Error).message, data: [] }
    }
  })

  // List GitHub PRs
  ipcMain.handle(IPC_CHANNELS.GITHUB_PRS_LIST, async (_, projectPath: string, state = 'open') => {
    // Validate state to prevent command injection
    const validState = VALID_PR_STATES.includes(state as typeof VALID_PR_STATES[number])
      ? state
      : 'open'

    try {
      const { stdout } = await execAsync(
        `gh pr list --state ${validState} --json number,title,state,createdAt,author,headRefName,mergeable --limit 100`,
        { cwd: projectPath }
      )
      return { success: true, data: JSON.parse(stdout || '[]') }
    } catch (error) {
      return { success: false, error: (error as Error).message, data: [] }
    }
  })
}
