/**
 * Strips ANSI/VT100 escape sequences and control characters from raw PTY output.
 * Raw node-pty buffers contain sequences for cursor movement, color, private modes
 * (e.g. bracketed paste \x1b[?2004h), etc. that must be removed before display.
 */

// Matches all common terminal escape sequence families:
// - CSI: \x1b[ + optional private/intermediate bytes + params + final byte
//   Covers standard (\x1b[m), private mode (\x1b[?2004h), DEC (\x1b[>4m), etc.
// - OSC: \x1b] + content + BEL or ST terminator
// - DCS/APC/PM/SOS: \x1bP/X/^/_ + content + ST
// - Character set designation: \x1b( or \x1b) + single char
// - Single-char ESC sequences: \x1b + letter or symbol (e.g. \x1b=, \x1b>, \x1bM)
const ANSI_PATTERN =
  /\x1b\[[0-9;?>=!]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[PX^_][^\x1b]*\x1b\\|\x1b[()][0-9A-Za-z]|\x1b[A-Za-z=><\\[\]^_]/g

// Non-printable control chars except \t (0x09) and \n (0x0A)
const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0b\x0c\x0e-\x1a\x1c-\x1f\x7f]/g

/**
 * Cleans raw PTY output for readable display:
 * 1. Strip all ANSI/VT100 escape sequences
 * 2. Normalize \r\n and bare \r to \n
 * 3. Expand tabs to spaces
 * 4. Remove remaining non-printable control characters
 * 5. Filter out blank lines
 */
export function cleanTerminalOutput(raw: string): string {
  return raw
    .replace(ANSI_PATTERN, '')
    .replace(CONTROL_CHARS_PATTERN, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .join('\n')
}
