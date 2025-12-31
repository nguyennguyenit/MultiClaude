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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--mc-bg-secondary)] rounded-lg p-4 w-96 max-w-[90vw]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--mc-text-primary)]">
            Configure Telegram
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--mc-bg-hover)] rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--mc-text-muted)] block mb-1">Bot Token</label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full px-2 py-1.5 text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
            />
          </div>

          <div>
            <label className="text-xs text-[var(--mc-text-muted)] block mb-1">Chat ID</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full px-2 py-1.5 text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
            />
          </div>

          <a
            href="https://core.telegram.org/bots#how-do-i-create-a-bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--mc-accent)] hover:underline block"
          >
            How to create a Telegram bot
          </a>

          {testResult && (
            <div className={`text-xs p-2 rounded ${testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {testResult.success ? 'Test successful!' : testResult.error}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {isConfigured && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleTest}
            disabled={!botToken || !chatId || testing}
            className="px-3 py-1.5 text-xs bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)] disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={handleSave}
            disabled={!botToken || !chatId}
            className="px-3 py-1.5 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50 ml-auto"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
