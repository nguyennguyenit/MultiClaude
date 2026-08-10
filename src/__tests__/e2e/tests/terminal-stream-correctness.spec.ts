import { test, expect } from '../fixtures'

test.describe('Terminal Stream Correctness', () => {
  test('preserves ordered output across preload IPC, resize, snapshot, and deletion', async ({ window }) => {
    const result = await window.evaluate(async () => {
      const appWindow = (globalThis as typeof globalThis & {
        window: Window & { electron: import('../../../preload').ElectronAPI }
      }).window
      const api = appWindow.electron.terminal
      const marker = 'MC_STREAM_GATE_731'
      const afterResizeMarker = 'MC_STREAM_AFTER_RESIZE_731'
      const chunks: Array<{ streamEpoch: string; sequence: number; data: string }> = []
      let terminalId: string | null = null
      const unsubscribe = api.onOutput((payload) => {
        if ('sequence' in payload && (!terminalId || payload.terminalId === terminalId)) chunks.push(payload)
      })
      const terminal = await api.create()
      terminalId = terminal.id

      try {
        const command = navigator.userAgent.includes('Windows')
          ? 'powershell -NoProfile -Command "[Console]::WriteLine([char[]](77,67,95,83,84,82,69,65,77,95,71,65,84,69,95,55,51,49))"\r'
          : "printf '\\115\\103\\137\\123\\124\\122\\105\\101\\115\\137\\107\\101\\124\\105\\137\\067\\063\\061\\n'\r"
        api.write(terminal.id, command)

        const deadline = Date.now() + 10_000
        while (!chunks.some(chunk => chunk.data.includes(marker)) && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 25))
        }

        api.resize(terminal.id, 100, 30)
        api.resize(terminal.id, 72, 24)
        const afterResizeCommand = navigator.userAgent.includes('Windows')
          ? 'powershell -NoProfile -Command "[Console]::WriteLine([char[]](77,67,95,83,84,82,69,65,77,95,65,70,84,69,82,95,82,69,83,73,90,69,95,55,51,49))"\r'
          : "printf '\\115\\103\\137\\123\\124\\122\\105\\101\\115\\137\\101\\106\\124\\105\\122\\137\\122\\105\\123\\111\\132\\105\\137\\067\\063\\061\\n'\r"
        api.write(terminal.id, afterResizeCommand)
        const afterResizeDeadline = Date.now() + 10_000
        while (!chunks.some(chunk => chunk.data.includes(afterResizeMarker)) && Date.now() < afterResizeDeadline) {
          await new Promise(resolve => setTimeout(resolve, 25))
        }
        const snapshot = await api.getSnapshot(terminal.id)
        const deliveredText = chunks.map(chunk => chunk.data).join('')
        const occurrences = (text: string, value: string) => text.split(value).length - 1
        const canonicalText = snapshot.ansi
        return {
          markerSeen: chunks.some(chunk => chunk.data.includes(marker)),
          afterResizeMarkerSeen: chunks.some(chunk => chunk.data.includes(afterResizeMarker)),
          epochs: [...new Set(chunks.map(chunk => chunk.streamEpoch))],
          sequences: chunks.map(chunk => chunk.sequence),
          snapshotHasMarker: snapshot.ansi.includes(marker),
          watermark: snapshot.watermark,
          markerSequence: chunks.find(chunk => chunk.data.includes(marker))?.sequence ?? 0,
          afterResizeSequence: chunks.find(chunk => chunk.data.includes(afterResizeMarker))?.sequence ?? 0,
          deliveredMarkerCount: occurrences(deliveredText, marker),
          deliveredAfterResizeMarkerCount: occurrences(deliveredText, afterResizeMarker),
          canonicalMarkerCount: occurrences(canonicalText, marker),
          canonicalAfterResizeMarkerCount: occurrences(canonicalText, afterResizeMarker),
          destroyed: await api.destroy(terminal.id),
        }
      } finally {
        unsubscribe()
      }
    })

    expect(result.markerSeen).toBe(true)
    expect(result.afterResizeMarkerSeen).toBe(true)
    // ConPTY may repaint prior screen content after resize, so raw PTY bytes can
    // contain a marker more than once without duplicating an output envelope.
    expect(result.deliveredMarkerCount).toBeGreaterThanOrEqual(1)
    expect(result.deliveredAfterResizeMarkerCount).toBeGreaterThanOrEqual(1)
    // The canonical mirror consumes the PTY byte stream faithfully. ConPTY may
    // repaint visible text after a resize, so textual occurrence counts are not
    // an exact-once signal. The mirror must retain each marker without inventing
    // more occurrences than the PTY delivered; envelope sequences below enforce
    // the actual exact-once transport contract.
    expect(result.canonicalMarkerCount).toBeGreaterThanOrEqual(1)
    expect(result.canonicalMarkerCount).toBeLessThanOrEqual(result.deliveredMarkerCount)
    expect(result.canonicalAfterResizeMarkerCount).toBeGreaterThanOrEqual(1)
    expect(result.canonicalAfterResizeMarkerCount).toBeLessThanOrEqual(
      result.deliveredAfterResizeMarkerCount,
    )
    expect(result.epochs).toHaveLength(1)
    expect(result.sequences).toEqual(
      Array.from({ length: result.sequences.at(-1) ?? 0 }, (_, index) => index + 1),
    )
    expect(result.snapshotHasMarker).toBe(true)
    // Output may legitimately arrive after the atomic snapshot barrier. Only
    // the marker observed before requesting the snapshot must be committed.
    expect(result.watermark).toBeGreaterThanOrEqual(result.markerSequence)
    expect(result.watermark).toBeGreaterThanOrEqual(result.afterResizeSequence)
    expect(result.destroyed).toBe(true)
  })
})
