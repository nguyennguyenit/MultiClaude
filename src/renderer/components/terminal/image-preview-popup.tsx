import { useState, useEffect, useCallback, memo } from 'react'

interface ImagePreviewPopupProps {
  imagePath: string | null
  position: { x: number; y: number } | null
  onClose: () => void
  onDelete: (path: string) => void
}

export const ImagePreviewPopup = memo(function ImagePreviewPopup({
  imagePath,
  position,
  onClose,
  onDelete
}: ImagePreviewPopupProps) {
  const [imageData, setImageData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Load image as base64 when path changes
  useEffect(() => {
    if (!imagePath) {
      setImageData(null)
      return
    }

    setLoading(true)
    window.electron.image.readBase64(imagePath)
      .then((base64) => {
        if (base64) {
          setImageData(`data:image/png;base64,${base64}`)
        } else {
          setImageData(null)
        }
      })
      .catch(() => setImageData(null))
      .finally(() => setLoading(false))
  }, [imagePath])

  const handleOpen = useCallback(() => {
    if (imagePath) {
      window.electron.image.open(imagePath)
    }
  }, [imagePath])

  const handleDelete = useCallback(() => {
    if (imagePath) {
      onDelete(imagePath)
    }
  }, [imagePath, onDelete])

  if (!imagePath || !position) return null

  return (
    <div
      className="image-preview-popup"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-8px)',
        zIndex: 9999,
        pointerEvents: 'auto'
      }}
      onMouseLeave={onClose}
    >
      <div className="bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded-lg shadow-xl p-2 flex flex-col items-center gap-2">
        {/* Image preview */}
        <div
          className="relative cursor-pointer rounded overflow-hidden"
          onClick={handleOpen}
          title="Click to open in viewer"
        >
          {loading ? (
            <div className="w-[180px] h-[120px] flex items-center justify-center text-[var(--mc-text-muted)]">
              Loading...
            </div>
          ) : imageData ? (
            <img
              src={imageData}
              alt="Preview"
              className="max-w-[180px] max-h-[120px] object-contain"
            />
          ) : (
            <div className="w-[180px] h-[120px] flex items-center justify-center text-[var(--mc-text-muted)]">
              Failed to load
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={handleOpen}
            className="flex-1 px-2 py-1 text-xs rounded bg-[var(--mc-bg-tertiary)] hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-primary)] transition-colors"
          >
            Open
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 px-2 py-1 text-xs rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
})
