import { EventEmitter } from 'events'
import type { TaskEvent, JsonStreamEvent, NotificationEventType } from '@shared/types'
import { generateTaskEventId } from './parser-utils'

/**
 * Parses Claude Code --output-format=stream-json NDJSON output.
 * Detects task events from tool_use/tool_result/error events.
 * Tracks model name and session duration from result events (inspired by ccpoke).
 */
export class JsonStreamParser extends EventEmitter {
  private buffers: Map<string, string> = new Map()
  private previousTodos: Map<string, Set<string>> = new Map()
  // Model name per terminal (set from result events)
  private terminalModels: Map<string, string> = new Map()

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
      const todos = (event.input as Record<string, unknown>)?.todos as Array<{content: string, status: string}> | undefined
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
      const question = (event.input as Record<string, unknown>)?.question as string || 'Input needed'
      this.emitTaskEvent(terminalId, 'reviewNeeded', question, projectName)
    }

    // Track model and duration from result events (like ccpoke does)
    if (event.type === 'result' && event.model) {
      this.terminalModels.set(terminalId, event.model)
    }
  }

  private detectNewlyCompleted(terminalId: string, todos: Array<{content: string, status: string}>): string[] {
    // Validate input array
    if (!Array.isArray(todos)) return []

    const previousSet = this.previousTodos.get(terminalId) || new Set()
    const newlyCompleted: string[] = []
    const currentSet = new Set<string>()

    for (const todo of todos) {
      // Validate todo object structure
      if (!todo || typeof todo.status !== 'string' || typeof todo.content !== 'string') continue
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
    const model = this.terminalModels.get(terminalId)
    const event: TaskEvent = {
      id: generateTaskEventId(terminalId, type, taskName),
      terminalId,
      type,
      taskName,
      projectName,
      // Include model in context if available (inspired by ccpoke)
      context: model ? `model: ${model}` : undefined,
      timestamp: Date.now()
    }
    this.emit('taskEvent', event)
  }

  clearTerminal(terminalId: string): void {
    this.buffers.delete(terminalId)
    this.previousTodos.delete(terminalId)
    this.terminalModels.delete(terminalId)
  }

  /** Clean up stale buffer entries older than 60s (for terminals that weren't properly closed) */
  cleanup(): void {
    // Buffers are per-terminal and should be cleaned via clearTerminal
    // This is a safety net for orphaned entries - clear very old ones
    // Note: We don't have timestamps here, so just limit map size as safety
    if (this.buffers.size > 100) {
      // Keep only most recent 50 entries (arbitrary safety limit)
      const entries = Array.from(this.buffers.entries())
      this.buffers = new Map(entries.slice(-50))
    }
    if (this.previousTodos.size > 100) {
      const entries = Array.from(this.previousTodos.entries())
      this.previousTodos = new Map(entries.slice(-50))
    }
    if (this.terminalModels.size > 100) {
      const entries = Array.from(this.terminalModels.entries())
      this.terminalModels = new Map(entries.slice(-50))
    }
  }
}
