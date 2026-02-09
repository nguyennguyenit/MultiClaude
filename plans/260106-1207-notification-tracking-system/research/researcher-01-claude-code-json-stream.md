# Claude Code Stream-JSON Output Format Research

## Overview
- Format: Newline-Delimited JSON (NDJSON) - each line = self-contained JSON object
- Flag: `--output-format stream-json` (use with `-p` for non-interactive)
- Granular streaming: add `--include-partial-messages` for real-time deltas

## Core Event Types

| Type | Purpose |
|------|---------|
| `init` | Session initialization |
| `message` | Complete message block (user/assistant) |
| `tool_use` | Tool invocation (contains `tool_name`, `input`) |
| `tool_result` | Tool execution outcome |
| `result` | Final task status/summary |
| `error` | Processing error |

## JSON Examples

### TodoWrite tool_use
```json
{"type":"tool_use","tool_name":"TodoWrite","id":"tool_use_xxx","input":{"todos":[{"content":"Fix bug","status":"completed","activeForm":"Fixing bug"}]}}
```

### tool_result (success)
```json
{"type":"tool_result","tool_use_id":"tool_use_xxx","content":"...","is_error":false}
```

### tool_result (error)
```json
{"type":"tool_result","tool_use_id":"tool_use_xxx","content":"Error: Command failed","is_error":true}
```

### AskUserQuestion
```json
{"type":"tool_use","tool_name":"AskUserQuestion","id":"tool_use_yyy","input":{"question":"Should I proceed?"}}
```

## Detection Strategy

| Event | Detection Logic |
|-------|----------------|
| Task completion | `tool_use` + `tool_name=TodoWrite` + `status=completed` |
| Failure | `tool_result.is_error=true` OR `type=error` |
| Review prompt | `tool_use` + `tool_name=AskUserQuestion` |

## Implementation Notes

```javascript
// Parse NDJSON stream
const parseStream = (data) => {
  return data.split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
};

// Detect task completion
const isTaskCompleted = (event) => {
  if (event.type !== 'tool_use' || event.tool_name !== 'TodoWrite') return false;
  return event.input?.todos?.some(t => t.status === 'completed');
};

// Detect errors
const isError = (event) => {
  return event.type === 'error' ||
         (event.type === 'tool_result' && event.is_error === true);
};

// Detect review prompts
const isReviewPrompt = (event) => {
  return event.type === 'tool_use' && event.tool_name === 'AskUserQuestion';
};
```

## Unresolved Questions

1. **Permission request format** - may be interactive-only, not exposed in stream
2. **Exit code mapping** - specific codes undocumented
3. **`result` event schema** - exact structure needs verification via testing
4. **Session correlation** - how to match events to sessions

## Sources
- Anthropic Claude Code CLI documentation
- Claude Code `--help` output
- Anthropic Messages API streaming spec
