# Phase 1: Types & Constants

## Context

- **Parent Plan:** [plan.md](./plan.md)
- **Research:** [Claude Code JSON Stream](./research/researcher-01-claude-code-json-stream.md)

## Overview

- **Priority:** P2
- **Status:** Done
- **Description:** Define TypeScript interfaces and constants for the enhanced notification tracking system

## Key Insights

- NDJSON format (newline-delimited JSON) for stream parsing
- `tool_use` events contain tool name and input
- `tool_result` events contain `is_error` flag
- Task ID hash: SHA256(terminalId + eventType + content).slice(0,16)

## Requirements

- TaskEvent interface with id, terminalId, type, taskName, projectName, timestamp
- Extended NotificationSettings with outputMode, notifyOnlyBackground, includeTaskSummary
- Enhanced detection patterns with named capture groups

## Related Code Files

**Create:**
- `src/shared/types/notification-events.ts`

**Modify:**
- `src/shared/types/notification.ts`
- `src/shared/constants/notification.ts`

## Implementation Steps

1. Create `src/shared/types/notification-events.ts`:
   ```typescript
   export interface TaskEvent {
     id: string              // SHA256 hash
     terminalId: string
     type: NotificationEventType
     taskName: string        // Extracted task name
     projectName: string     // From terminal metadata
     context?: string        // Last tool, duration
     timestamp: number
   }

   export interface JsonStreamEvent {
     type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'result' | 'error'
     tool_name?: string
     id?: string
     input?: Record<string, unknown>
     tool_use_id?: string
     content?: string
     is_error?: boolean
   }
   ```

2. Extend `NotificationSettings` in `src/shared/types/notification.ts`:
   ```typescript
   export type OutputMode = 'auto' | 'stream-json' | 'plain-text'

   export interface NotificationSettings {
     // ... existing fields
     outputMode: OutputMode                    // Default: 'auto'
     notifyOnlyBackground: boolean             // Default: true
     includeTaskSummary: boolean               // Default: true
   }
   ```

3. Update `DEFAULT_NOTIFICATION_SETTINGS` in `src/shared/constants/notification.ts`:
   ```typescript
   export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
     // ... existing
     outputMode: 'auto',
     notifyOnlyBackground: true,
     includeTaskSummary: true
   }
   ```

4. Add enhanced detection patterns:
   ```typescript
   export const ENHANCED_DETECTION_PATTERNS = {
     taskComplete: /✓\s+(?<taskName>.+?)(?:\s*\(completed\)|$)/i,
     taskFailed: /✗\s+(?<taskName>.+?)(?:\s*\(failed\)|$)|exit(?:ed)?\s+(?:with\s+)?code\s+(?<exitCode>\d+)/i,
     reviewNeeded: /\[Y\/n\]|\(y\/N\)|approve|allow\s+(?:this\s+)?tool|waiting\s+for\s+(?:your\s+)?(?:input|response|confirmation)/i
   }
   ```

## Todo List

- [x] Create notification-events.ts with TaskEvent, JsonStreamEvent interfaces
- [x] Add OutputMode type and extend NotificationSettings
- [x] Update DEFAULT_NOTIFICATION_SETTINGS with new fields
- [x] Add ENHANCED_DETECTION_PATTERNS with capture groups
- [x] Export new types from shared/types/index.ts
- [x] Export new constants from shared/constants/index.ts

## Success Criteria

- [x] All new types compile without errors
- [x] Existing code continues to work (backward compatible)
- [x] New patterns have named capture groups for task extraction

## Risk Assessment

- **Low:** Type-only changes, no runtime impact
- Adding new optional fields maintains backward compatibility

## Security Considerations

- None for this phase (type definitions only)

## Next Steps

→ Phase 2: Output Parser Infrastructure
