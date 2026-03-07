/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FocusDetector } from '../focus-detector'

// Mock Electron BrowserWindow
const createMockWindow = (isFocused = true) => {
  const listeners: { [key: string]: (() => void)[] } = { focus: [], blur: [] }
  return {
    isFocused: vi.fn(() => isFocused),
    isDestroyed: vi.fn(() => false),
    on: vi.fn((event: string, callback: () => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(callback)
    }),
    removeListener: vi.fn((event: string, callback: () => void) => {
      if (listeners[event]) {
        const idx = listeners[event].indexOf(callback)
        if (idx !== -1) listeners[event].splice(idx, 1)
      }
    }),
    // Helper to trigger events in tests
    _trigger: (event: string) => listeners[event]?.forEach(cb => cb()),
    _listenerCount: (event: string) => listeners[event]?.length || 0
  }
}

describe('FocusDetector', () => {
  let detector: FocusDetector

  beforeEach(() => {
    detector = new FocusDetector()
  })

  describe('setWindow', () => {
    it('initializes with current window focus state', () => {
      const mockWindow = createMockWindow(true)
      detector.setWindow(mockWindow as any)

      expect(detector.isWindowFocused()).toBe(true)
    })

    it('initializes as unfocused when window is blurred', () => {
      const mockWindow = createMockWindow(false)
      detector.setWindow(mockWindow as any)

      expect(detector.isWindowFocused()).toBe(false)
    })

    it('registers focus and blur event listeners', () => {
      const mockWindow = createMockWindow(true)
      detector.setWindow(mockWindow as any)

      expect(mockWindow.on).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(mockWindow.on).toHaveBeenCalledWith('blur', expect.any(Function))
    })

    it('removes existing listeners when replacing window', () => {
      const mockWindow1 = createMockWindow(true)
      const mockWindow2 = createMockWindow(false)

      detector.setWindow(mockWindow1 as any)
      expect(mockWindow1._listenerCount('focus')).toBe(1)

      detector.setWindow(mockWindow2 as any)
      expect(mockWindow1.removeListener).toHaveBeenCalled()
      expect(mockWindow2._listenerCount('focus')).toBe(1)
    })
  })

  describe('focus event handling', () => {
    it('updates state on focus event', () => {
      const mockWindow = createMockWindow(false)
      detector.setWindow(mockWindow as any)
      expect(detector.isWindowFocused()).toBe(false)

      mockWindow._trigger('focus')
      expect(detector.isWindowFocused()).toBe(true)
    })

    it('updates state on blur event', () => {
      const mockWindow = createMockWindow(true)
      detector.setWindow(mockWindow as any)
      expect(detector.isWindowFocused()).toBe(true)

      mockWindow._trigger('blur')
      expect(detector.isWindowFocused()).toBe(false)
    })
  })

  describe('setActiveTerminal', () => {
    it('stores active terminal ID', () => {
      detector.setActiveTerminal('term-1')
      expect(detector.getActiveTerminalId()).toBe('term-1')
    })

    it('handles null terminal ID', () => {
      detector.setActiveTerminal('term-1')
      detector.setActiveTerminal(null)
      expect(detector.getActiveTerminalId()).toBeNull()
    })

    it('ignores empty string terminal ID', () => {
      detector.setActiveTerminal('term-1')
      detector.setActiveTerminal('')
      expect(detector.getActiveTerminalId()).toBe('term-1')
    })

    it('ignores whitespace-only terminal ID', () => {
      detector.setActiveTerminal('term-1')
      detector.setActiveTerminal('   ')
      expect(detector.getActiveTerminalId()).toBe('term-1')
    })
  })

  describe('shouldNotify', () => {
    beforeEach(() => {
      const mockWindow = createMockWindow(true)
      detector.setWindow(mockWindow as any)
    })

    it('returns true when window is not focused', () => {
      const mockWindow = createMockWindow(false)
      detector.setWindow(mockWindow as any)
      detector.setActiveTerminal('term-1')

      expect(detector.shouldNotify('term-1')).toBe(true)
    })

    it('returns true when different terminal is active', () => {
      detector.setActiveTerminal('term-2')

      expect(detector.shouldNotify('term-1')).toBe(true)
    })

    it('returns false when user is watching the terminal', () => {
      detector.setActiveTerminal('term-1')

      expect(detector.shouldNotify('term-1')).toBe(false)
    })

    it('returns true when no active terminal is set', () => {
      // activeTerminalId is null by default
      expect(detector.shouldNotify('term-1')).toBe(true)
    })

    it('returns true for invalid input (empty string)', () => {
      detector.setActiveTerminal('term-1')
      expect(detector.shouldNotify('')).toBe(true)
    })
  })

  describe('destroy', () => {
    it('removes event listeners on destroy', () => {
      const mockWindow = createMockWindow(true)
      detector.setWindow(mockWindow as any)

      detector.destroy()

      expect(mockWindow.removeListener).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(mockWindow.removeListener).toHaveBeenCalledWith('blur', expect.any(Function))
    })

    it('resets state to defaults on destroy', () => {
      const mockWindow = createMockWindow(false)
      detector.setWindow(mockWindow as any)
      detector.setActiveTerminal('term-1')

      expect(detector.isWindowFocused()).toBe(false)
      expect(detector.getActiveTerminalId()).toBe('term-1')

      detector.destroy()

      expect(detector.isWindowFocused()).toBe(true) // Reset to default
      expect(detector.getActiveTerminalId()).toBeNull() // Reset to null
    })
  })
})
