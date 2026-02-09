# Research: ssh2 Node.js Library

**Date**: 2026-01-08
**Topic**: SSH2 library for Node.js shell sessions

---

## Overview

`ssh2` is the industry-standard SSH client library for Node.js. Pure JavaScript, no native compilation, Electron compatible.

## Key Features

| Feature | Description |
|---------|-------------|
| Shell sessions | Interactive PTY-like shell via `conn.shell()` |
| Exec commands | Single command execution via `conn.exec()` |
| Auth methods | Password, public key, keyboard-interactive, agent |
| Agent forwarding | Forward local SSH agent to remote |
| SFTP | File transfer (out of scope for v1) |

## Authentication Methods

### 1. SSH Agent (Recommended)
```typescript
conn.connect({
  host: 'server.com',
  username: 'user',
  agent: process.env.SSH_AUTH_SOCK // Unix
  // or: agent: 'pageant' // Windows
})
```

### 2. Private Key File
```typescript
import fs from 'fs'
conn.connect({
  host: 'server.com',
  username: 'user',
  privateKey: fs.readFileSync('/path/to/key'),
  passphrase: 'optional-passphrase'
})
```

### 3. Password
```typescript
conn.connect({
  host: 'server.com',
  username: 'user',
  password: 'password'
})
```

## Shell Session Pattern

```typescript
import { Client } from 'ssh2'

const conn = new Client()
conn.on('ready', () => {
  conn.shell({ term: 'xterm-256color' }, (err, stream) => {
    if (err) throw err

    stream.on('data', (data: Buffer) => {
      // Emit to renderer like PTY output
      emit('output', { terminalId: id, data: data.toString() })
    })

    stream.on('close', () => {
      conn.end()
    })

    // Write input from user
    stream.write('ls -la\n')
  })
})

conn.on('error', (err) => {
  console.error('SSH error:', err)
})

conn.connect({ host, port, username, privateKey })
```

## Window Resize

```typescript
// Resize remote PTY
stream.setWindow(rows, cols, height, width)
```

## Reconnection Handling

- Listen for `close` and `error` events
- Implement exponential backoff (1s → 2s → 4s)
- Keep connection config for reconnect attempts
- Show user notification on disconnect

## Cross-Platform Considerations

| Platform | SSH Agent |
|----------|-----------|
| Linux/macOS | `SSH_AUTH_SOCK` env var |
| Windows | Pageant (`agent: 'pageant'`) or OpenSSH Agent |

## Electron Integration Notes

- ssh2 is pure JS, works in main process
- Store ssh2 Client instances in Map like PTY processes
- Emit same events as local terminals (output, exit)
- Handle `keyboard-interactive` auth for 2FA prompts

## Dependencies

```json
{
  "ssh2": "^1.16.0"
}
```

---

## Sources

- npm: ssh2
- GitHub: mscdex/ssh2
