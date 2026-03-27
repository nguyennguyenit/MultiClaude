const LEAKED_CURSOR_POSITION_REPORT_LINE_REGEX = /(^|[\r\n])\s*(?:>\s*)?(?:\[\d+;\d+R)+\s*(?=$|[\r\n])/g

export function stripLeakedTerminalResponses(data: string): string {
  return data.replace(LEAKED_CURSOR_POSITION_REPORT_LINE_REGEX, (_match, prefix: string) => prefix)
}
