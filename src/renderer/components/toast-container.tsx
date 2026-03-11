import { useToastStore } from '../stores/toast-store'

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      right: '12px',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${
              toast.type === 'error' ? '#f7768e' :
              toast.type === 'warning' ? '#e0af68' : 'var(--accent)'
            }`,
            maxWidth: '360px',
            color: 'var(--text-primary)',
            animation: 'slideIn 0.2s ease',
            pointerEvents: 'auto'
          }}
        >
          <span style={{ flex: 1, lineHeight: 1.5 }}>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: '16px',
              lineHeight: 1,
              flexShrink: 0
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
