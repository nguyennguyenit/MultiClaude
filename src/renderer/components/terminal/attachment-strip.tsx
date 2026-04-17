import { memo, useEffect, useState } from 'react'
import { useImageStore, type ImageEntry } from '../../stores/image-store'

interface AttachmentStripProps {
  terminalId: string
  onRemove: (filePath: string, entry: ImageEntry) => void
}

function basename(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx === -1 ? filePath : filePath.slice(idx + 1)
}

interface TileProps {
  entry: ImageEntry
  onRemove: (filePath: string, entry: ImageEntry) => void
}

const AttachmentTile = memo(function AttachmentTile({ entry, onRemove }: TileProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [errored, setErrored] = useState(false)
  const name = basename(entry.filePath)
  const isVideo = entry.type === 'video'

  useEffect(() => {
    if (isVideo) return
    let cancelled = false
    window.electron.media
      .readDataUrl(entry.filePath)
      .then((url) => {
        if (!cancelled) {
          if (url) setDataUrl(url)
          else setErrored(true)
        }
      })
      .catch(() => {
        if (!cancelled) setErrored(true)
      })
    return () => {
      cancelled = true
    }
  }, [entry.filePath, isVideo])

  return (
    <div className="attachment-tile" title={name} aria-label={name}>
      {isVideo ? (
        <div className="attachment-tile-video" data-testid="attachment-video-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />
          </svg>
          <span className="attachment-tile-video-name">{name}</span>
        </div>
      ) : dataUrl ? (
        <img src={dataUrl} alt={name} className="attachment-tile-img" />
      ) : errored ? (
        <div className="attachment-tile-skeleton attachment-tile-skeleton-error" aria-hidden="true">
          ?
        </div>
      ) : (
        <div className="attachment-tile-skeleton" aria-hidden="true" />
      )}
      <button
        type="button"
        className="attachment-tile-remove"
        aria-label={`Remove ${name}`}
        onClick={(e) => {
          e.stopPropagation()
          onRemove(entry.filePath, entry)
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
})

export const AttachmentStrip = memo(function AttachmentStrip({
  terminalId,
  onRemove
}: AttachmentStripProps) {
  const entries = useImageStore((s) => s.images[terminalId])
  if (!entries || entries.length === 0) return null
  return (
    <div className="attachment-strip" role="list" aria-label="Attached files">
      {entries.map((entry) => (
        <AttachmentTile
          key={`${entry.type}-${entry.index}-${entry.timestamp}`}
          entry={entry}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
})
