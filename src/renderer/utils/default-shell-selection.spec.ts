import { describe, expect, it, vi } from 'vitest'
import type { ShellInfo } from '@shared/types'
import { reconcileSavedDefaultShell } from './default-shell-selection'

const zsh: ShellInfo = { path: '/bin/zsh', name: 'zsh', isDefault: true, kind: 'unix' }
const fish: ShellInfo = { path: '/usr/local/bin/fish', name: 'fish', isDefault: false, kind: 'unix' }

describe('reconcileSavedDefaultShell', () => {
  it('does nothing until the shell list has finished loading', async () => {
    const setSelectedShell = vi.fn()
    const persistDefaultShell = vi.fn()

    await reconcileSavedDefaultShell({
      hasLoadedShells: false,
      shells: [],
      savedDefault: zsh,
      setSelectedShell,
      persistDefaultShell
    })

    expect(setSelectedShell).not.toHaveBeenCalled()
    expect(persistDefaultShell).not.toHaveBeenCalled()
  })

  it('restores the matching shell from the latest available shell list', async () => {
    const setSelectedShell = vi.fn()
    const persistDefaultShell = vi.fn()

    await reconcileSavedDefaultShell({
      hasLoadedShells: true,
      shells: [zsh, fish],
      savedDefault: { ...zsh, name: 'old zsh label' },
      setSelectedShell,
      persistDefaultShell
    })

    expect(setSelectedShell).toHaveBeenCalledOnce()
    expect(setSelectedShell).toHaveBeenCalledWith(zsh)
    expect(persistDefaultShell).not.toHaveBeenCalled()
  })

  it('clears the selected shell and persists the reset when the saved shell is no longer available', async () => {
    const setSelectedShell = vi.fn()
    const persistDefaultShell = vi.fn()

    await reconcileSavedDefaultShell({
      hasLoadedShells: true,
      shells: [fish],
      savedDefault: zsh,
      setSelectedShell,
      persistDefaultShell
    })

    expect(setSelectedShell).toHaveBeenCalledOnce()
    expect(setSelectedShell).toHaveBeenCalledWith(null)
    expect(persistDefaultShell).toHaveBeenCalledOnce()
    expect(persistDefaultShell).toHaveBeenCalledWith(null)
  })

  it('leaves persisted settings untouched when there is no saved default shell', async () => {
    const setSelectedShell = vi.fn()
    const persistDefaultShell = vi.fn()

    await reconcileSavedDefaultShell({
      hasLoadedShells: true,
      shells: [zsh],
      setSelectedShell,
      persistDefaultShell
    })

    expect(setSelectedShell).toHaveBeenCalledOnce()
    expect(setSelectedShell).toHaveBeenCalledWith(null)
    expect(persistDefaultShell).not.toHaveBeenCalled()
  })
})
