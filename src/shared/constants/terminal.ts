// Raw PTY transcript buffer — kept large enough to replay a full default scrollback window
// when rebuildHeadless() reconstructs the headless mirror from raw output.
// 3 MB ≈ 20k default scrollback lines × ~150 chars/line (SCROLLBACK_DEFAULT = 20_000).
// Increasing this is the prerequisite for Part F (refresh rebuilds from raw) and Part D
// (auto-rebuild on cols change) to produce artifact-free snapshots.
export const TERMINAL_OUTPUT_BUFFER_MAX = 3_000_000
export const TERMINAL_OUTPUT_BUFFER_TRIM_TO = 2_500_000

// Headless terminal scrollback for snapshot/restore (phase 1)
// Measured baseline: ~3.8 MB/terminal at 10k lines on M-series. Target: ≤30 MB for 5 terminals.
export const HEADLESS_SCROLLBACK_LINES = 10_000

// xterm.js scrollback buffer size (lines kept in memory for scroll-up)
export const SCROLLBACK_MIN = 1_000
export const SCROLLBACK_MAX = 200_000
export const SCROLLBACK_DEFAULT = 20_000
export const SCROLLBACK_PRESETS = [5_000, 20_000, 50_000, 100_000] as const
