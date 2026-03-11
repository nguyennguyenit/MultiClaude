# Phase 2: Output Parser Infrastructure

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Depends On:** Phase 1 (Types & Constants)
- **Research:** [Claude Code JSON Stream](./research/researcher-01-claude-code-json-stream.md)

## Overview

- **Priority:** P2
- **Status:** Done
- **Description:** Create dual-mode parser architecture with JSON stream and enhanced plain text parsing

## Key Insights

- NDJSON = one JSON object per line
- `tool_use` with `tool_name: "TodoWrite"` + `status: "completed"` = task completion
- `tool_result` with `is_error: true` = task failure
- `tool_use` with `tool_name: "AskUserQuestion"` = review needed

## Requirements

- OutputParser router to select parsing mode based on settings
- JsonStreamParser for NDJSON format
- PlainTextParser with enhanced regex patterns
- TaskEvent emission on detection

## Related Code Files

**Create:**
- `src/main/notification/output-parser.ts`
- `src/main/notification/json-stream-parser.ts`
- `src/main/notification/plain-text-parser.ts`

**Reference:**
- `src/main/notification/pattern-detector.ts` (existing, for pattern reference)

## Implementation Steps

### 1. Create `src/main/notification/output-parser.ts`

```typescript
import { EventEmitter } from 'events'
import type { TaskEvent, OutputMode, NotificationSettings } from '@shared/types'
import { JsonStreamParser } from './json-stream-parser'
import { PlainTextParser } from './plain-text-parser'

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

  parse(terminalId: string, data: string, projectName: string): void {
    // Determine parser based on mode
    if (this.mode === 'stream-json') {
      this.jsonParser.parse(terminalId, data, projectName)
    } else if (this.mode === 'plain-text') {
      this.textParser.parse(terminalId, data, projectName)
    } else {
      // Auto mode: detect format from content
      this.autoDetectAndParse(terminalId, data, projectName)
    }
  }

  private autoDetectAndParse(terminalId: string, data: string, projectName: string): void {
    // Check if terminal already has a locked parser type
    const lockedMode = this.terminalModes.get(terminalId)
    if (lockedMode) {
      // Use locked parser
      if (lockedMode === 'json') {
        this.jsonParser.parse(terminalId, data, projectName)
      } else {
        this.textParser.parse(terminalId, data, projectName)
      }
      return
    }

    // First-time detection: try to detect and lock
    const lines = data.split('\n').filter(l => l.trim())
    const isJson = lines.some(line => {
      try { JSON.parse(line); return true } catch { return false }
    })

    if (isJson) {
      this.terminalModes.set(terminalId, 'json')  // Lock to JSON
      this.jsonParser.parse(terminalId, data, projectName)
    } else {
      this.terminalModes.set(terminalId, 'text')  // Lock to text
      this.textParser.parse(terminalId, data, projectName)
    }
  }

  clearTerminal(terminalId: string): void {
    this.terminalModes.delete(terminalId)
    this.jsonParser.clearTerminal(terminalId)
    this.textParser.clearTerminal(terminalId)
  }
}
```

### 2. Create `src/main/notification/json-stream-parser.ts`

```typescript
import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import type { TaskEvent, JsonStreamEvent, NotificationEventType } from '@shared/types'

export class JsonStreamParser extends EventEmitter {
  private buffers: Map<string, string> = new Map()
  private previousTodos: Map<string, Set<string>> = new Map()

  parse(terminalId: string, data: string, projectName: string): void {
    // Append to line buffer
    const buffer = (this.buffers.get(terminalId) || '') + data
    const lines = buffer.split('\n')

    // Keep incomplete last line in buffer
    this.buffers.set(terminalId, lines.pop() || '')

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line) as JsonStreamEvent
        this.processEvent(terminalId, event, projectName)
      } catch {
        // Not JSON, ignore
      }
    }
  }

  private processEvent(terminalId: string, event: JsonStreamEvent, projectName: string): void {
    // Task completion: TodoWrite with completed status
    if (event.type === 'tool_use' && event.tool_name === 'TodoWrite') {
      const todos = (event.input as any)?.todos as Array<{content: string, status: string}> | undefined
      if (todos) {
        const completedNames = this.detectNewlyCompleted(terminalId, todos)
        for (const taskName of completedNames) {
          this.emitTaskEvent(terminalId, 'taskComplete', taskName, projectName)
        }
      }
    }

    // Task failure: tool_result with is_error
    if (event.type === 'tool_result' && event.is_error) {
      const taskName = this.extractErrorContext(event.content || 'Task failed')
      this.emitTaskEvent(terminalId, 'taskFailed', taskName, projectName)
    }

    // Error event
    if (event.type === 'error') {
      this.emitTaskEvent(terminalId, 'taskFailed', event.content || 'Error occurred', projectName)
    }

    // Review needed: AskUserQuestion
    if (event.type === 'tool_use' && event.tool_name === 'AskUserQuestion') {
      const question = (event.input as any)?.question || 'Input needed'
      this.emitTaskEvent(terminalId, 'reviewNeeded', question, projectName)
    }
  }

  private detectNewlyCompleted(terminalId: string, todos: Array<{content: string, status: string}>): string[] {
    const previousSet = this.previousTodos.get(terminalId) || new Set()
    const newlyCompleted: string[] = []
    const currentSet = new Set<string>()

    for (const todo of todos) {
      if (todo.status === 'completed') {
        currentSet.add(todo.content)
        if (!previousSet.has(todo.content)) {
          newlyCompleted.push(todo.content)
        }
      }
    }

    this.previousTodos.set(terminalId, currentSet)
    return newlyCompleted
  }

  private extractErrorContext(content: string): string {
    // Extract first meaningful line or truncate
    const firstLine = content.split('\n')[0]
    return firstLine.slice(0, 100)
  }

  private emitTaskEvent(terminalId: string, type: NotificationEventType, taskName: string, projectName: string): void {
    const event: TaskEvent = {
      id: this.generateId(terminalId, type, taskName),
      terminalId,
      type,
      taskName,
      projectName,
      timestamp: Date.now()
    }
    this.emit('taskEvent', event)
  }

  private generateId(terminalId: string, type: string, content: string): string {
    return createHash('sha256')
      .update(`${terminalId}:${type}:${content}`)
      .digest('hex')
      .slice(0, 16)
  }

  clearTerminal(terminalId: string): void {
    this.buffers.delete(terminalId)
    this.previousTodos.delete(terminalId)
  }
}
```

### 3. Create `src/main/notification/plain-text-parser.ts`

```typescript
import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import type { TaskEvent, NotificationEventType } from '@shared/types'
import { ENHANCED_DETECTION_PATTERNS } from '@shared/constants'

export class PlainTextParser extends EventEmitter {
  private debounceMap: Map<string, number> = new Map()
  private debounceMs = 5000

  parse(terminalId: string, data: string, projectName: string): void {
    // Check each pattern
    for (const [type, pattern] of Object.entries(ENHANCED_DETECTION_PATTERNS)) {
      const match = data.match(pattern)
      if (match) {
        const key = `${terminalId}:${type}`
        const now = Date.now()
        const lastEmit = this.debounceMap.get(key) || 0

        if (now - lastEmit > this.debounceMs) {
          this.debounceMap.set(key, now)

          // Extract task name from named groups or full match
          const taskName = match.groups?.taskName || match.groups?.exitCode
            ? `Exit code ${match.groups.exitCode}`
            : match[0].slice(0, 100)

          this.emitTaskEvent(terminalId, type as NotificationEventType, taskName, projectName)
        }
      }
    }
  }

  private emitTaskEvent(terminalId: string, type: NotificationEventType, taskName: string, projectName: string): void {
    const event: TaskEvent = {
      id: this.generateId(terminalId, type, taskName),
      terminalId,
      type,
      taskName,
      projectName,
      timestamp: Date.now()
    }
    this.emit('taskEvent', event)
  }

  private generateId(terminalId: string, type: string, content: string): string {
    return createHash('sha256')
      .update(`${terminalId}:${type}:${content}`)
      .digest('hex')
      .slice(0, 16)
  }

  clearTerminal(terminalId: string): void {
    // Clear debounce entries for this terminal
    for (const [key] of this.debounceMap) {
      if (key.startsWith(`${terminalId}:`)) {
        this.debounceMap.delete(key)
      }
    }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, time] of this.debounceMap) {
      if (now - time > 60000) {
        this.debounceMap.delete(key)
      }
    }
  }
}
```

## Todo List

- [x] Create output-parser.ts with mode routing
- [x] Create json-stream-parser.ts with NDJSON parsing
- [x] Create plain-text-parser.ts with enhanced regex
- [x] Add exports to notification/index.ts
- [x] Unit test: JSON parsing of tool_use events
- [x] Unit test: Plain text pattern matching

## Success Criteria

- [x] JSON parser correctly extracts task names from TodoWrite events
- [x] JSON parser detects errors from tool_result.is_error
- [x] JSON parser detects review prompts from AskUserQuestion
- [x] Text parser extracts task names via named capture groups
- [x] Both parsers emit TaskEvent with unique IDs

## Risk Assessment

- **Medium:** JSON schema may vary - implement error recovery
- **Low:** Regex patterns may need tuning based on actual output

## Security Considerations

- JSON.parse on untrusted input - use try/catch
- Truncate task names to prevent memory issues

## Next Steps

→ Phase 3: Focus Detection & Deduplication
