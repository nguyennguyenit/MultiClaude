const SYNC_OUTPUT_START = '\x1b[?2026h'
const SYNC_OUTPUT_END = '\x1b[?2026l'
const ERASE_DISPLAY = '\x1b[2J'

/**
 * Works around xterm.js 6 resetting the viewport for ED2 inside a synchronized
 * output block. The parser keeps partial control sequences between PTY chunks,
 * so filtering never depends on IPC envelope boundaries.
 */
export class SynchronizedOutputFilter {
  private inSyncOutput = false
  private pending = ''

  process(data: string): string {
    if (!this.pending && !this.inSyncOutput && !data.includes('\x1b')) return data

    const input = this.pending + data
    this.pending = ''
    let output = ''
    let index = 0

    while (index < input.length) {
      if (input.startsWith(SYNC_OUTPUT_START, index)) {
        this.inSyncOutput = true
        output += SYNC_OUTPUT_START
        index += SYNC_OUTPUT_START.length
        continue
      }

      if (input.startsWith(SYNC_OUTPUT_END, index)) {
        this.inSyncOutput = false
        output += SYNC_OUTPUT_END
        index += SYNC_OUTPUT_END.length
        continue
      }

      if (this.inSyncOutput && input.startsWith(ERASE_DISPLAY, index)) {
        index += ERASE_DISPLAY.length
        continue
      }

      const remainder = input.slice(index)
      const possibleSequences = this.inSyncOutput
        ? [SYNC_OUTPUT_START, SYNC_OUTPUT_END, ERASE_DISPLAY]
        : [SYNC_OUTPUT_START]
      if (possibleSequences.some(sequence => sequence.startsWith(remainder))) {
        this.pending = remainder
        break
      }

      output += input[index]
      index += 1
    }

    return output
  }
}
