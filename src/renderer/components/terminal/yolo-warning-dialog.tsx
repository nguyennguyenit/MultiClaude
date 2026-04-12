interface YoloWarningDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

/** First-time YOLO mode warning dialog. Shown once per project; never again after confirmation. */
export function YoloWarningDialog({ onConfirm, onCancel }: YoloWarningDialogProps) {
  const handleOverlayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      className="yolo-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yolo-dialog-title"
      onKeyDown={handleOverlayKeyDown}
      tabIndex={-1}
    >
      <div className="yolo-dialog">
        <h3 id="yolo-dialog-title">⚡ Enable YOLO Mode?</h3>
        <p>
          Claude will execute all commands{' '}
          <strong>without asking for permission</strong> — including deleting
          files, running scripts, and calling external APIs.
        </p>
        <p className="yolo-dialog-sub">Only use in projects you fully trust.</p>
        <div className="yolo-dialog-actions">
          <button type="button" className="yolo-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="yolo-btn-confirm" onClick={onConfirm}>
            Enable YOLO Mode
          </button>
        </div>
      </div>
    </div>
  )
}
