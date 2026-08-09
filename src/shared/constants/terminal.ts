// Local app-restart restoration and live remote-control tails are distinct
// retention contracts. Both limits are encoded UTF-8 bytes, not JS code units.
export const RESTORE_TAIL_MAX_BYTES = 3_000_000
export const RESTORE_TAIL_TRIM_TO_BYTES = 2_500_000
export const NOTIFICATION_TAIL_MAX_BYTES = 3_000_000
export const TERMINAL_OUTPUT_BUFFER_MAX = RESTORE_TAIL_MAX_BYTES
export const TERMINAL_OUTPUT_BUFFER_TRIM_TO = RESTORE_TAIL_TRIM_TO_BYTES

// Headless terminal scrollback for snapshot/restore (phase 1)
// Measured baseline: ~3.8 MB/terminal at 10k lines on M-series. Target: ≤30 MB for 5 terminals.
export const CANONICAL_SCROLLBACK_LINES = 20_000
export const HEADLESS_SCROLLBACK_LINES = CANONICAL_SCROLLBACK_LINES

// xterm.js scrollback buffer size (lines kept in memory for scroll-up)
export const SCROLLBACK_MIN = 1_000
export const SCROLLBACK_MAX = 200_000
export const SCROLLBACK_DEFAULT = 20_000
export const SCROLLBACK_PRESETS = [5_000, 20_000, 50_000, 100_000] as const
