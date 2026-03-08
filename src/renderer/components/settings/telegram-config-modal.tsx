import { useState } from 'react'

interface TelegramConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (botToken: string, chatId: string) => void
  isConfigured: boolean
  onClear: () => void
}

export function TelegramConfigModal({
  isOpen,
  onClose,
  onSave,
  isConfigured,
  onClear
}: TelegramConfigModalProps) {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  if (!isOpen) return null

  const handleTest = async () => {
    if (!botToken || !chatId) return
    setTesting(true)
    setTestResult(null)

    try {
      const result = await window.electron.notification.testTelegram(botToken, chatId)
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, error: String(error) })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!botToken || !chatId) return
    onSave(botToken, chatId)
    setBotToken('')
    setChatId('')
    setTestResult(null)
    onClose()
  }

  const handleClear = () => {
    onClear()
    setBotToken('')
    setChatId('')
    setTestResult(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-xl w-[420px] max-w-[92vw] flex flex-col" style={{ background: 'var(--mc-bg-secondary)', border: '1px solid color-mix(in srgb, var(--mc-accent) 25%, var(--mc-border))', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--mc-border)' }}>
          <h3 className="text-base font-semibold text-[var(--mc-text-primary)]">Configure Telegram</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-[var(--mc-bg-hover)]"
            style={{ border: 'none', background: 'transparent', color: 'var(--mc-text-muted)', cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--mc-text-secondary)] block mb-1.5">Bot Token</label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
              style={{ background: 'var(--mc-bg-primary)', border: '1px solid var(--mc-border)', color: 'var(--mc-text-primary)' }}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--mc-text-secondary)] block mb-1.5">Chat ID</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
              style={{ background: 'var(--mc-bg-primary)', border: '1px solid var(--mc-border)', color: 'var(--mc-text-primary)' }}
            />
          </div>

          <a
            href="https://core.telegram.org/bots#how-do-i-create-a-bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--mc-accent)] hover:underline"
          >
            How to create a Telegram bot
          </a>

          {testResult && (
            <div className={`text-xs px-3 py-2 rounded-md ${testResult.success ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {testResult.success ? '✓ Test successful!' : testResult.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--mc-border)' }}>
          {isConfigured && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-red-500/20"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
          <button
            onClick={handleTest}
            disabled={!botToken || !chatId || testing}
            className="px-4 py-1.5 text-sm rounded-md font-medium transition-all disabled:opacity-40"
            style={{ background: 'var(--mc-bg-hover)', color: 'var(--mc-text-primary)', border: '1px solid var(--mc-border)', cursor: 'pointer' }}
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={handleSave}
            disabled={!botToken || !chatId}
            className="px-4 py-1.5 text-sm rounded-md font-semibold transition-all disabled:opacity-40 ml-auto"
            style={{ background: 'var(--mc-accent)', color: 'var(--mc-bg-primary)', border: '2px solid var(--mc-accent)', boxShadow: '0 0 12px color-mix(in srgb, var(--mc-accent) 40%, transparent)', cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
