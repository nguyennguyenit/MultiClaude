export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] as const
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'] as const

export type MediaKind = 'image' | 'video'

export function classifyMediaFile(filePath: string): MediaKind | null {
  const dotIndex = filePath.lastIndexOf('.')
  if (dotIndex < 0) return null
  const ext = filePath.toLowerCase().slice(dotIndex + 1)
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return 'image'
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) return 'video'
  return null
}
