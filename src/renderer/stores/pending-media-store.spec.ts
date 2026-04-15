import { beforeEach, describe, expect, it } from 'vitest'
import { usePendingMediaStore } from './pending-media-store'

const TOKEN = { path: '/foo.png', displayLength: 9 }

describe('usePendingMediaStore', () => {
  beforeEach(() => {
    usePendingMediaStore.setState({ queues: {} })
  })

  it('push adds token to queue', () => {
    usePendingMediaStore.getState().push('t1', TOKEN)
    expect(usePendingMediaStore.getState().getQueue('t1').tokens).toHaveLength(1)
  })

  it('flush returns paths in order and clears queue', () => {
    usePendingMediaStore.getState().push('t1', { path: '/a.png', displayLength: 9 })
    usePendingMediaStore.getState().push('t1', { path: '/b.mp4', displayLength: 9 })
    const paths = usePendingMediaStore.getState().flush('t1')
    expect(paths).toEqual(['/a.png', '/b.mp4'])
    expect(usePendingMediaStore.getState().getQueue('t1').tokens).toHaveLength(0)
    expect(usePendingMediaStore.getState().getQueue('t1').charsAfterLastToken).toBe(0)
  })

  it('flush on empty returns empty array', () => {
    expect(usePendingMediaStore.getState().flush('t1')).toEqual([])
  })

  it('clear removes all tokens and resets charsAfterLastToken', () => {
    usePendingMediaStore.getState().push('t1', TOKEN)
    usePendingMediaStore.getState().incrementCharsAfter('t1')
    usePendingMediaStore.getState().clear('t1')
    const q = usePendingMediaStore.getState().getQueue('t1')
    expect(q.tokens).toHaveLength(0)
    expect(q.charsAfterLastToken).toBe(0)
  })

  it('decrementCharsAfter returns true and decrements when counter > 0', () => {
    usePendingMediaStore.getState().push('t1', TOKEN)
    usePendingMediaStore.getState().incrementCharsAfter('t1')
    const wasNormal = usePendingMediaStore.getState().decrementCharsAfter('t1')
    expect(wasNormal).toBe(true)
    expect(usePendingMediaStore.getState().getQueue('t1').charsAfterLastToken).toBe(0)
  })

  it('decrementCharsAfter returns false when counter is 0', () => {
    usePendingMediaStore.getState().push('t1', TOKEN)
    const wasNormal = usePendingMediaStore.getState().decrementCharsAfter('t1')
    expect(wasNormal).toBe(false)
  })

  it('popToken removes and returns last token', () => {
    usePendingMediaStore.getState().push('t1', { path: '/a.png', displayLength: 9 })
    usePendingMediaStore.getState().push('t1', { path: '/b.mp4', displayLength: 9 })
    const popped = usePendingMediaStore.getState().popToken('t1')
    expect(popped?.path).toBe('/b.mp4')
    expect(usePendingMediaStore.getState().getQueue('t1').tokens).toHaveLength(1)
  })

  it('popToken returns null when no tokens', () => {
    expect(usePendingMediaStore.getState().popToken('t1')).toBeNull()
  })

  it('queues are independent per terminal', () => {
    usePendingMediaStore.getState().push('t1', TOKEN)
    usePendingMediaStore.getState().clear('t2')
    expect(usePendingMediaStore.getState().getQueue('t1').tokens).toHaveLength(1)
  })
})
