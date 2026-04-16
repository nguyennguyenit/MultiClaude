import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllWriters,
  registerDisplayWriter,
  writeToDisplay
} from './display-writer-registry'

describe('display-writer-registry', () => {
  beforeEach(() => {
    clearAllWriters()
  })

  it('writeToDisplay calls registered writer', () => {
    const writer = vi.fn()
    registerDisplayWriter('t1', writer)
    writeToDisplay('t1', '[Image 1]')
    expect(writer).toHaveBeenCalledWith('[Image 1]')
  })

  it('writeToDisplay is no-op when no writer registered', () => {
    expect(() => writeToDisplay('unknown', '[Image 1]')).not.toThrow()
  })

  it('registerDisplayWriter returns cleanup function', () => {
    const writer = vi.fn()
    const cleanup = registerDisplayWriter('t1', writer)
    cleanup()
    writeToDisplay('t1', 'test')
    expect(writer).not.toHaveBeenCalled()
  })

  it('multiple terminals have independent writers', () => {
    const w1 = vi.fn()
    const w2 = vi.fn()
    registerDisplayWriter('t1', w1)
    registerDisplayWriter('t2', w2)
    writeToDisplay('t1', 'A')
    expect(w1).toHaveBeenCalledWith('A')
    expect(w2).not.toHaveBeenCalled()
  })

  it('cleanup does not remove a replaced writer', () => {
    const w1 = vi.fn()
    const w2 = vi.fn()
    const cleanup1 = registerDisplayWriter('t1', w1)
    registerDisplayWriter('t1', w2)
    cleanup1()
    writeToDisplay('t1', 'X')
    expect(w2).toHaveBeenCalledWith('X')
  })
})
