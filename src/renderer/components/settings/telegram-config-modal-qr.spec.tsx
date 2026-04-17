// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react'
import { TelegramConfigModal } from './telegram-config-modal'

interface ElectronApi {
  notification: {
    getTelegram: () => Promise<{ botToken: string; chatId: string } | null>
    testTelegram: (botToken: string, chatId: string) => Promise<{ success: boolean; error?: string }>
  }
  telegram: {
    startPairing: (botToken: string) => Promise<{
      ok: boolean
      nonce?: string
      botUsername?: string
      error?: string
    }>
    cancelPairing: () => Promise<boolean>
    getPairingStatus: () => Promise<{ state: 'idle' | 'waiting' | 'completed' }>
    onPairingWaiting: (cb: (p: { nonce: string; botUsername: string }) => void) => () => void
    onPaired: (cb: (p: { chatId: number; botToken: string }) => void) => () => void
    onPairingTimeout: (cb: () => void) => () => void
    onPairingWarning: (cb: (p: { chatId: number }) => void) => () => void
  }
}

function makeElectronMock(): ElectronApi & {
  __firePaired: (p: { chatId: number; botToken: string }) => void
  __fireTimeout: () => void
} {
  let pairedCb: ((p: { chatId: number; botToken: string }) => void) | null = null
  let timeoutCb: (() => void) | null = null

  return {
    notification: {
      getTelegram: vi.fn().mockResolvedValue(null),
      testTelegram: vi.fn().mockResolvedValue({ success: true })
    },
    telegram: {
      startPairing: vi.fn().mockResolvedValue({
        ok: true,
        nonce: 'deadbeefcafebabe',
        botUsername: 'my_test_bot'
      }),
      cancelPairing: vi.fn().mockResolvedValue(true),
      getPairingStatus: vi.fn().mockResolvedValue({ state: 'idle' }),
      onPairingWaiting: vi.fn().mockReturnValue(() => {}),
      onPaired: vi.fn().mockImplementation((cb) => {
        pairedCb = cb
        return () => { pairedCb = null }
      }),
      onPairingTimeout: vi.fn().mockImplementation((cb) => {
        timeoutCb = cb
        return () => { timeoutCb = null }
      }),
      onPairingWarning: vi.fn().mockReturnValue(() => {})
    },
    __firePaired: (p) => pairedCb?.(p),
    __fireTimeout: () => timeoutCb?.()
  }
}

describe('TelegramConfigModal — QR pairing', () => {
  let api: ReturnType<typeof makeElectronMock>

  beforeEach(() => {
    api = makeElectronMock()
    ;(globalThis as unknown as { window: { electron: ElectronApi } }).window.electron = api
  })

  it('shows QR pairing option when bot token is entered and chatId is empty', async () => {
    render(
      <TelegramConfigModal
        isOpen={true}
        isConfigured={false}
        onClose={() => {}}
        onSave={() => {}}
        onClear={() => {}}
      />
    )

    const tokenInput = await screen.findByPlaceholderText('123456:ABC-DEF...')
    await act(async () => {
      fireEvent.change(tokenInput, { target: { value: '123456:FAKE-TOKEN' } })
    })

    // A "Scan QR" action should appear (button or link)
    const scanBtn = await screen.findByRole('button', { name: /scan qr|pair via qr|qr/i })
    expect(scanBtn).toBeTruthy()
  })

  it('calls telegram.startPairing when user clicks Scan QR', async () => {
    render(
      <TelegramConfigModal
        isOpen={true}
        isConfigured={false}
        onClose={() => {}}
        onSave={() => {}}
        onClear={() => {}}
      />
    )

    const tokenInput = await screen.findByPlaceholderText('123456:ABC-DEF...')
    await act(async () => {
      fireEvent.change(tokenInput, { target: { value: '123:FAKE' } })
    })
    const scanBtn = await screen.findByRole('button', { name: /scan qr|pair via qr|qr/i })
    await act(async () => {
      fireEvent.click(scanBtn)
    })

    await waitFor(() => {
      expect(api.telegram.startPairing).toHaveBeenCalledWith('123:FAKE')
    })
  })

  it('closes modal and fires onSave when "paired" event arrives', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(
      <TelegramConfigModal
        isOpen={true}
        isConfigured={false}
        onClose={onClose}
        onSave={onSave}
        onClear={() => {}}
      />
    )

    const tokenInput = await screen.findByPlaceholderText('123456:ABC-DEF...')
    await act(async () => {
      fireEvent.change(tokenInput, { target: { value: '123:FAKE' } })
    })
    const scanBtn = await screen.findByRole('button', { name: /scan qr|pair via qr|qr/i })
    await act(async () => {
      fireEvent.click(scanBtn)
    })

    await waitFor(() => {
      expect(api.telegram.startPairing).toHaveBeenCalled()
    })

    // Simulate the paired IPC event firing
    await act(async () => {
      api.__firePaired({ chatId: 789, botToken: '123:FAKE' })
    })

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('123:FAKE', '789')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('cancel button during pairing calls telegram.cancelPairing', async () => {
    render(
      <TelegramConfigModal
        isOpen={true}
        isConfigured={false}
        onClose={() => {}}
        onSave={() => {}}
        onClear={() => {}}
      />
    )

    const tokenInput = await screen.findByPlaceholderText('123456:ABC-DEF...')
    await act(async () => {
      fireEvent.change(tokenInput, { target: { value: '123:FAKE' } })
    })
    const scanBtn = await screen.findByRole('button', { name: /scan qr|pair via qr|qr/i })
    await act(async () => {
      fireEvent.click(scanBtn)
    })

    const cancelBtn = await screen.findByRole('button', { name: /cancel pairing/i })
    await act(async () => {
      fireEvent.click(cancelBtn)
    })

    await waitFor(() => {
      expect(api.telegram.cancelPairing).toHaveBeenCalled()
    })
  })
})
