import { useState } from 'react'

interface DiscordConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (webhookUrl: string) => void
  isConfigured: boolean
  onClear: () => void
}

export function DiscordConfigModal({
  isOpen,
  onClose,
  onSave,
  isConfigured,
  onClear
}: DiscordConfigModalProps) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  if (!isOpen) return null

  const handleTest = async () => {
    if (!webhookUrl) return
    setTesting(true)
    setTestResult(null)

    try {
      const result = await window.electron.notification.testDiscord(webhookUrl)
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, error: String(error) })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!webhookUrl) return
    onSave(webhookUrl)
    setWebhookUrl('')
    setTestResult(null)
    onClose()
  }

  const handleClear = () => {
    onClear()
    setWebhookUrl('')
    setTestResult(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--mc-bg-secondary)] rounded-lg p-4 w-96 max-w-[90vw]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--mc-text-primary)]">
            Configure Discord
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--mc-bg-hover)] rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--mc-text-muted)] block mb-1">Webhook URL</label>
            <input
              type="password"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full px-2 py-1.5 text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
            />
          </div>

          <a
            href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--mc-accent)] hover:underline block"
          >
            How to create a Discord webhook
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
            disabled={!webhookUrl || testing}
            className="px-3 py-1.5 text-xs bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)] disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={handleSave}
            disabled={!webhookUrl}
            className="px-3 py-1.5 text-xs bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] rounded hover:opacity-90 disabled:opacity-50 ml-auto"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
