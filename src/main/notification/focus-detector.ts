import { BrowserWindow } from 'electron'

/**
 * Tracks window focus and active terminal to determine if notifications should be sent.
 * Notifications are suppressed when user is actively watching the terminal.
 */
export class FocusDetector {
  private window: BrowserWindow | null = null
  private windowFocused = true
  private activeTerminalId: string | null = null
  private focusHandler: (() => void) | null = null
  private blurHandler: (() => void) | null = null

  setWindow(window: BrowserWindow): void {
    // Remove existing listeners if replacing window
    this.removeWindowListeners()

    this.window = window
    this.windowFocused = window.isFocused()

    this.focusHandler = () => {
      this.windowFocused = true
    }

    this.blurHandler = () => {
      this.windowFocused = false
    }

    window.on('focus', this.focusHandler)
    window.on('blur', this.blurHandler)
  }

  setActiveTerminal(terminalId: string | null): void {
    // Validate terminalId if provided
    if (terminalId !== null && typeof terminalId === 'string' && terminalId.trim() === '') {
      return // Ignore empty strings
    }
    this.activeTerminalId = terminalId
  }

  /**
   * Determine if notification should be sent.
   * Returns true if: window unfocused OR different terminal is active
   */
  shouldNotify(terminalId: string): boolean {
    // Validate input
    if (!terminalId || typeof terminalId !== 'string') {
      return true // Safe fallback: notify on invalid input
    }

    // Always notify if window is not focused
    if (!this.windowFocused) {
      return true
    }

    // Notify if a different terminal is active
    if (this.activeTerminalId !== terminalId) {
      return true
    }

    // User is looking at this terminal - don't notify
    return false
  }

  isWindowFocused(): boolean {
    return this.windowFocused
  }

  getActiveTerminalId(): string | null {
    return this.activeTerminalId
  }

  private removeWindowListeners(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.focusHandler) {
        this.window.removeListener('focus', this.focusHandler)
      }
      if (this.blurHandler) {
        this.window.removeListener('blur', this.blurHandler)
      }
    }
    this.focusHandler = null
    this.blurHandler = null
  }

  destroy(): void {
    this.removeWindowListeners()
    this.window = null
    this.windowFocused = true // Reset to default
    this.activeTerminalId = null
  }
}
