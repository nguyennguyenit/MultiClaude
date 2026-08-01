const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).byteLength
}

/** Keep at most maxBytes from the end without starting inside a UTF-8 scalar. */
export function truncateUtf8Tail(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  const encoded = encoder.encode(value)
  if (encoded.byteLength <= maxBytes) return value

  let start = encoded.byteLength - maxBytes
  while (start < encoded.byteLength && (encoded[start] & 0b1100_0000) === 0b1000_0000) {
    start += 1
  }
  return decoder.decode(encoded.subarray(start))
}

/**
 * Append-only UTF-8 tail that avoids rebuilding and encoding the complete tail
 * for every terminal output chunk. The full string is materialized only when a
 * consumer reads it or when the high-water mark requires a trim.
 */
export class Utf8TailBuffer {
  private chunks: string[] = []
  private encodedBytes = 0

  constructor(
    private readonly maxBytes: number,
    private readonly trimToBytes: number,
  ) {
    if (maxBytes < 0 || trimToBytes < 0 || trimToBytes > maxBytes) {
      throw new RangeError('UTF-8 tail limits must satisfy 0 <= trimToBytes <= maxBytes')
    }
  }

  append(data: string): void {
    if (!data) return

    this.chunks.push(data)
    this.encodedBytes += utf8ByteLength(data)
    if (this.encodedBytes <= this.maxBytes) return

    const sliced = truncateUtf8Tail(this.chunks.join(''), this.trimToBytes)
    const newlineIndex = sliced.indexOf('\n')
    const trimmed = newlineIndex >= 0 ? sliced.slice(newlineIndex + 1) : sliced
    this.chunks = trimmed ? [trimmed] : []
    this.encodedBytes = utf8ByteLength(trimmed)
  }

  clear(): void {
    this.chunks = []
    this.encodedBytes = 0
  }

  toString(): string {
    return this.chunks.join('')
  }

  get byteLength(): number {
    return this.encodedBytes
  }
}
