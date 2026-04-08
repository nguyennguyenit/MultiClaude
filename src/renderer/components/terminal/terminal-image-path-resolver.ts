const CLAUDE_IMAGE_REF_REGEX = /\[Image #(\d+)\]/
const SCREENSHOT_PATH_REGEX = /"?([^\s"]*multiClaude-screenshots[\\/]+screenshot-\d+\.png)"?/i
const IMAGE_PATH_REGEX = /"?((?:[A-Za-z]:[\\/]|[/~])[^\s"]*\.(?:png|jpg|jpeg|gif|webp|bmp|svg))"?/i

interface TrackedImagePath {
  filePath: string
  index: number
}

interface ResolveImagePathOptions {
  lineText: string
  trackedImages: TrackedImagePath[]
  screenshotPaths?: string[]
}

export function resolveImagePathFromLine({
  lineText,
  trackedImages,
  screenshotPaths = []
}: ResolveImagePathOptions): string | null {
  const imageRefMatch = CLAUDE_IMAGE_REF_REGEX.exec(lineText)
  if (imageRefMatch) {
    const imageIndex = Number.parseInt(imageRefMatch[1], 10)
    const trackedImage = trackedImages.find((image) => image.index === imageIndex)
    if (trackedImage) {
      return trackedImage.filePath
    }

    if (imageIndex > 0 && screenshotPaths.length >= imageIndex) {
      return screenshotPaths[imageIndex - 1]
    }
  }

  for (const image of trackedImages) {
    if (lineText.includes(image.filePath)) {
      return image.filePath
    }
  }

  const screenshotMatch = SCREENSHOT_PATH_REGEX.exec(lineText)
  if (screenshotMatch) {
    return screenshotMatch[1]
  }

  const imagePathMatch = IMAGE_PATH_REGEX.exec(lineText)
  if (imagePathMatch) {
    return imagePathMatch[1]
  }

  return null
}
