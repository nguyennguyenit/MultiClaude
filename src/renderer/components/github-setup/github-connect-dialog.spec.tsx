import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitBranch } from '@shared/types'

const stateQueue: unknown[] = []

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')

  return {
    ...actual,
    useEffect: vi.fn(),
    useState: vi.fn((initialValue: unknown) => {
      const value = stateQueue.length > 0 ? stateQueue.shift() : initialValue
      return [value, vi.fn()] as const
    })
  }
})

import { GitHubConnectDialog } from './github-connect-dialog'

function queueBranchSelectState(branches: GitBranch[], selectedBranch: string, showWhyBranch = false) {
  stateQueue.length = 0
    stateQueue.push(
      'branch-select',
      false,
      null,
      false,
      'SampleProject',
      true,
      '',
      branches,
      selectedBranch,
      'created',
      'SampleProject',
      showWhyBranch
    )
}

describe('GitHubConnectDialog branch-select step', () => {
  beforeEach(() => {
    stateQueue.length = 0
  })

  it('renders a fixed branch card when only one local branch is available', () => {
    queueBranchSelectState([
      { name: 'main', current: true, commit: 'abc123', label: 'main', isRemote: false }
    ], 'main')

    const html = renderToStaticMarkup(
      <GitHubConnectDialog
        isOpen
        projectName="SampleProject"
        projectPath="/tmp/SampleProject"
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(html).toContain('Only local branch available')
    expect(html).not.toContain('<select')
  })

  it('keeps a chooser when multiple local branches are available', () => {
    queueBranchSelectState([
      { name: 'main', current: true, commit: 'abc123', label: 'main', isRemote: false },
      { name: 'release', current: false, commit: 'def456', label: 'release', isRemote: false }
    ], 'main')

    const html = renderToStaticMarkup(
      <GitHubConnectDialog
        isOpen
        projectName="SampleProject"
        projectPath="/tmp/SampleProject"
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(html).toContain('<select')
    expect(html).toContain('release')
  })

  it('renders the why-push panel with an explicit custom toggle style hook', () => {
    queueBranchSelectState([
      { name: 'main', current: true, commit: 'abc123', label: 'main', isRemote: false }
    ], 'main')

    const html = renderToStaticMarkup(
      <GitHubConnectDialog
        isOpen
        projectName="SampleProject"
        projectPath="/tmp/SampleProject"
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(html).toContain('github-connect-why-toggle')
    expect(html).toContain('Why push to remote?')
  })
})
