// Cursor Position Report: ESC [ row ; col R  (ESC optional if consumed upstream)
// Lookbehind asserts we're at start-of-line (not consuming the preceding newline).
// Match consumes the CPR content + its trailing newline so no blank line is left behind.
const LEAKED_CPR_LINE_REGEX = /(?<=^|[\r\n])[ \t]*(?:>[ \t]*)?(?:\x1b?\[\d+;\d+R)+[ \t]*(?:\r?\n|$)/g

// OSC 11 background-color response: ESC ] 11 ; rgb:rrrr/gggg/bbbb ST  (ST = ESC \ or BEL)
const LEAKED_OSC11_REGEX = /\x1b\]11;[^\x07\x1b]*(?:\x07|\x1b\\)/g

// Primary Device Attributes response: ESC [ ? ... c
const LEAKED_DA_RESPONSE_REGEX = /\x1b\[\?[\d;]*c/g

export function stripLeakedTerminalResponses(data: string): string {
  return data
    .replace(LEAKED_OSC11_REGEX, '')
    .replace(LEAKED_DA_RESPONSE_REGEX, '')
    .replace(LEAKED_CPR_LINE_REGEX, '')
}
