const CLAUDE_IMAGE_REF_REGEX = /\[Image #(\d+)\]/
const SCREENSHOT_PATH_REGEX = /"?([^\s"]*multiClaude-screenshots[\\/]+screenshot-\d+\.png)"?/i
const IMAGE_PATH_REGEX = /"?((?:[A-Za-z]:[\\/]|[/~])[^\s"]*\.(?:png|jpg|jpeg|gif|webp|bmp|svg))"?/i
const VIDEO_PATH_REGEX = /"?((?:[A-Za-z]:[\\/]|[/~])[^\s"]*\.(?:mp4|mov|avi|mkv|webm|m4v|wmv))"?/i

export const IMAGE_TOKEN_REGEX = /\[Image (\d+)\]/
export const VIDEO_TOKEN_REGEX = /\[Video (\d+)\]/

interface TrackedMediaEntry {
  filePath: string
  index: number
  type?: 'image' | 'video'
}

interface ResolveMediaPathOptions {
  lineText: string
  trackedImages: TrackedMediaEntry[]
  screenshotPaths?: string[]
}

export function resolveMediaPathFromLine({
  lineText,
  trackedImages,
  screenshotPaths = []
}: ResolveMediaPathOptions): string | null {
  // 1. Claude output refs: [Image #N]
  const claudeRefMatch = CLAUDE_IMAGE_REF_REGEX.exec(lineText)
  if (claudeRefMatch) {
    const imageIndex = Number.parseInt(claudeRefMatch[1], 10)
    const tracked = trackedImages.find(
      (m) => m.index === imageIndex && (m.type ?? 'image') === 'image'
    )
    if (tracked) return tracked.filePath
    if (imageIndex > 0 && screenshotPaths.length >= imageIndex) {
      return screenshotPaths[imageIndex - 1]
    }
  }

  // 2. Input image token: [Image N]
  const imageTokenMatch = IMAGE_TOKEN_REGEX.exec(lineText)
  if (imageTokenMatch) {
    const idx = Number.parseInt(imageTokenMatch[1], 10)
    const tracked = trackedImages.find((m) => m.index === idx && (m.type ?? 'image') === 'image')
    if (tracked) return tracked.filePath
  }

  // 3. Input video token: [Video N]
  const videoTokenMatch = VIDEO_TOKEN_REGEX.exec(lineText)
  if (videoTokenMatch) {
    const idx = Number.parseInt(videoTokenMatch[1], 10)
    const tracked = trackedImages.find((m) => m.index === idx && m.type === 'video')
    if (tracked) return tracked.filePath
  }

  // 4. Tracked media file paths appearing verbatim
  for (const media of trackedImages) {
    if (lineText.includes(media.filePath)) return media.filePath
  }

  // 5. Screenshot paths
  const screenshotMatch = SCREENSHOT_PATH_REGEX.exec(lineText)
  if (screenshotMatch) return screenshotMatch[1]

  // 6. Image paths
  const imagePathMatch = IMAGE_PATH_REGEX.exec(lineText)
  if (imagePathMatch) return imagePathMatch[1]

  // 7. Video paths
  const videoPathMatch = VIDEO_PATH_REGEX.exec(lineText)
  if (videoPathMatch) return videoPathMatch[1]

  return null
}

export const resolveImagePathFromLine = resolveMediaPathFromLine
