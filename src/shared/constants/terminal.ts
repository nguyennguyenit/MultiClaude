export const TERMINAL_OUTPUT_BUFFER_MAX = 100_000
export const TERMINAL_OUTPUT_BUFFER_TRIM_TO = 80_000

// xterm.js scrollback buffer size (lines kept in memory for scroll-up)
export const SCROLLBACK_MIN = 1_000
export const SCROLLBACK_MAX = 200_000
export const SCROLLBACK_DEFAULT = 20_000
export const SCROLLBACK_PRESETS = [5_000, 20_000, 50_000, 100_000] as const
