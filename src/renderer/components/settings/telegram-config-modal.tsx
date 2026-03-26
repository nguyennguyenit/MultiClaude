import { useEffect, useRef, useState } from 'react'

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
  const [testPassed, setTestPassed] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Load saved credentials when modal opens
  useEffect(() => {
    if (!isOpen) return
    setTestResult(null)
    setTestPassed(false)

    window.electron.notification.getTelegram().then((creds) => {
      if (creds) {
        setBotToken(creds.botToken)
        setChatId(creds.chatId)
        setTestPassed(true) // Already saved = already tested
      } else {
        setBotToken('')
        setChatId('')
      }
    })
  }, [isOpen])

  if (!isOpen) return null

  // Reset test state when credentials change
  const handleTokenChange = (value: string) => {
    setBotToken(value)
    setTestPassed(false)
    setTestResult(null)
  }

  const handleChatIdChange = (value: string) => {
    setChatId(value)
    setTestPassed(false)
    setTestResult(null)
  }

  const handleTest = async () => {
    if (!botToken || !chatId) return
    setTesting(true)
    setTestResult(null)

    try {
      const result = await window.electron.notification.testTelegram(botToken, chatId)
      setTestResult(result)
      setTestPassed(result.success)
    } catch (error) {
      setTestResult({ success: false, error: String(error) })
      setTestPassed(false)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!botToken || !chatId || !testPassed) return
    onSave(botToken, chatId)
    onClose()
  }

  const handleClear = () => {
    onClear()
    setBotToken('')
    setChatId('')
    setTestResult(null)
    setTestPassed(false)
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
            <FieldLabel label="Bot Token" tooltip={BOT_TOKEN_HELP} />
            <input
              type="password"
              value={botToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
              style={{ background: 'var(--mc-bg-primary)', border: '1px solid var(--mc-border)', color: 'var(--mc-text-primary)' }}
            />
          </div>

          <div>
            <FieldLabel label="Chat ID" tooltip={CHAT_ID_HELP} />
            <input
              type="text"
              value={chatId}
              onChange={(e) => handleChatIdChange(e.target.value)}
              placeholder="-1001234567890"
              className="w-full px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--mc-accent)]/50"
              style={{ background: 'var(--mc-bg-primary)', border: '1px solid var(--mc-border)', color: 'var(--mc-text-primary)' }}
            />
          </div>

          <div className="text-[11px] leading-relaxed px-3 py-2.5 rounded-md" style={{ background: 'var(--mc-bg-primary)', border: '1px solid var(--mc-border)', color: 'var(--mc-text-muted)' }}>
            <strong style={{ color: 'var(--mc-text-secondary)' }}>Important:</strong> You must send <code className="px-1 py-0.5 rounded text-[var(--mc-accent)]" style={{ background: 'var(--mc-bg-hover)' }}>/start</code> to your bot in Telegram before testing. The bot cannot message you until you initiate the conversation first.
          </div>

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
            disabled={!botToken || !chatId || !testPassed}
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

const BOT_TOKEN_HELP = [
  '1. Open Telegram and search for @BotFather',
  '2. Send /newbot and follow the prompts',
  '3. Copy the token (format: 123456:ABC-DEF...)',
  '4. Send /start to your new bot before testing'
]

const CHAT_ID_HELP = [
  'Personal chat:',
  '  1. Search for @userinfobot on Telegram',
  '  2. Send any message — it replies with your ID',
  '',
  'Group/Channel:',
  '  1. Add your bot to the group',
  '  2. Send a message in the group',
  '  3. Open: api.telegram.org/bot<TOKEN>/getUpdates',
  '  4. Find "chat":{"id": -100xxxx} in the response'
]

function FieldLabel({ label, tooltip }: { label: string; tooltip: string[] }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [show])

  return (
    <div className="flex items-center gap-1.5 mb-1.5 relative" ref={ref}>
      <label className="text-xs font-medium text-[var(--mc-text-secondary)]">{label}</label>
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold transition-colors"
        style={{
          background: show ? 'var(--mc-accent)' : 'var(--mc-bg-hover)',
          color: show ? 'var(--mc-bg-primary)' : 'var(--mc-text-muted)',
          border: 'none',
          cursor: 'pointer',
          lineHeight: 1
        }}
      >
        ?
      </button>
      {show && (
        <div
          className="absolute left-0 top-full mt-1 z-10 rounded-lg px-3.5 py-3 text-[11px] leading-relaxed whitespace-pre-wrap"
          style={{
            background: 'var(--mc-bg-primary)',
            border: '1px solid var(--mc-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            color: 'var(--mc-text-secondary)',
            minWidth: '280px',
            maxWidth: '340px'
          }}
        >
          {tooltip.map((line, i) => (
            <div key={i} style={{ minHeight: line === '' ? '6px' : undefined }}>{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}
