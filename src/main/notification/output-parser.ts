import { EventEmitter } from 'events'
import type { OutputMode, AgentType } from '@shared/types'
import { JsonStreamParser } from './json-stream-parser'
import { PlainTextParser } from './plain-text-parser'

/**
 * Router that selects parsing mode based on settings.
 * Auto mode detects and locks terminal to detected parser type.
 */
export class OutputParser extends EventEmitter {
  private jsonParser: JsonStreamParser
  private textParser: PlainTextParser
  private mode: OutputMode = 'auto'
  private terminalModes: Map<string, 'json' | 'text'> = new Map()

  constructor() {
    super()
    this.jsonParser = new JsonStreamParser()
    this.textParser = new PlainTextParser()

    // Forward events from child parsers
    this.jsonParser.on('taskEvent', (event) => this.emit('taskEvent', event))
    this.textParser.on('taskEvent', (event) => this.emit('taskEvent', event))
  }

  setMode(mode: OutputMode): void {
    this.mode = mode
  }

  parse(terminalId: string, data: string, projectName: string, agentType?: AgentType): void {
    if (this.mode === 'stream-json') {
      this.jsonParser.parse(terminalId, data, projectName)
    } else if (this.mode === 'plain-text') {
      this.textParser.parse(terminalId, data, projectName, agentType)
    } else {
      // Auto mode: detect format from content
      this.autoDetectAndParse(terminalId, data, projectName, agentType)
    }
  }

  private autoDetectAndParse(terminalId: string, data: string, projectName: string, agentType?: AgentType): void {
    // Check if terminal already has a locked parser type
    const lockedMode = this.terminalModes.get(terminalId)
    if (lockedMode) {
      if (lockedMode === 'json') {
        this.jsonParser.parse(terminalId, data, projectName)
      } else {
        this.textParser.parse(terminalId, data, projectName, agentType)
      }
      return
    }

    // First-time detection: use heuristic to detect JSON format
    // Heuristic: line starts with '{' and ends with '}' (NDJSON pattern)
    const lines = data.split('\n').filter(l => l.trim())
    const isJson = lines.some(line => {
      const trimmed = line.trim()
      return trimmed.startsWith('{') && trimmed.endsWith('}')
    })

    if (isJson) {
      this.terminalModes.set(terminalId, 'json')  // Lock to JSON
      this.jsonParser.parse(terminalId, data, projectName)
    } else {
      this.terminalModes.set(terminalId, 'text')  // Lock to text
      this.textParser.parse(terminalId, data, projectName, agentType)
    }
  }

  clearTerminal(terminalId: string): void {
    this.terminalModes.delete(terminalId)
    this.jsonParser.clearTerminal(terminalId)
    this.textParser.clearTerminal(terminalId)
  }

  /** Get locked parser type for a terminal (for testing/debugging) */
  getTerminalParserType(terminalId: string): 'json' | 'text' | undefined {
    return this.terminalModes.get(terminalId)
  }

  /** Clean up stale entries in all parsers */
  cleanup(): void {
    this.textParser.cleanup()
    this.jsonParser.cleanup()
    // Also limit terminalModes map size as safety net
    if (this.terminalModes.size > 100) {
      const entries = Array.from(this.terminalModes.entries())
      this.terminalModes = new Map(entries.slice(-50))
    }
  }
}
