# Research: SSH Config Parsing

**Date**: 2026-01-08
**Topic**: Parsing ~/.ssh/config in Node.js

---

## Overview

`ssh-config` is the industry standard for parsing SSH config files. Handles wildcards, inheritance, case insensitivity.

## Key Features

| Feature | Description |
|---------|-------------|
| Parse & stringify | Roundtrip without losing comments/formatting |
| `compute(host)` | Get effective config for host (resolves wildcards) |
| Case insensitive | Handles SSH's case-insensitive keywords |
| Wildcards | Supports `Host *` and pattern matching |

## Basic Usage

```typescript
import fs from 'fs'
import path from 'path'
import SSHConfig from 'ssh-config'

const configPath = path.join(process.env.HOME!, '.ssh', 'config')

try {
  const content = fs.readFileSync(configPath, 'utf8')
  const config = SSHConfig.parse(content)

  // Get effective config for a host (resolves wildcards)
  const options = config.compute('my-server')

  console.log(`Host: ${options.HostName}`)
  console.log(`User: ${options.User}`)
  console.log(`Port: ${options.Port || 22}`)
  console.log(`IdentityFile: ${options.IdentityFile}`)
} catch (err) {
  console.error('Error reading SSH config:', err.message)
}
```

## Common Directives

| Directive | Description |
|-----------|-------------|
| Host | Alias/pattern for this config block |
| HostName | Actual hostname or IP |
| User | Default username |
| Port | SSH port (default 22) |
| IdentityFile | Path to private key |
| ForwardAgent | Enable agent forwarding |

## File Watching with chokidar

```typescript
import chokidar from 'chokidar'
import path from 'path'
import os from 'os'

const configPath = path.join(os.homedir(), '.ssh', 'config')

const watcher = chokidar.watch(configPath, {
  persistent: true,
  ignoreInitial: true
})

watcher.on('change', () => {
  // Re-parse config file
  parseSSHConfig()
})

watcher.on('error', (err) => {
  console.error('Watcher error:', err)
})
```

## Cross-Platform Paths

| Platform | Config Path |
|----------|-------------|
| Linux/macOS | `~/.ssh/config` |
| Windows | `%USERPROFILE%\.ssh\config` |

Use `os.homedir()` for cross-platform compatibility.

## Error Handling

```typescript
function parseSSHConfig(): SSHProfile[] {
  const configPath = path.join(os.homedir(), '.ssh', 'config')

  if (!fs.existsSync(configPath)) {
    return [] // No config file - valid state
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8')
    const config = SSHConfig.parse(content)

    // Extract named hosts (skip wildcards for UI)
    return config
      .filter(section => section.param === 'Host')
      .filter(section => !section.value.includes('*'))
      .map(section => ({
        name: section.value,
        ...config.compute(section.value)
      }))
  } catch (err) {
    console.warn('SSH config parse error:', err.message)
    return [] // Graceful fallback
  }
}
```

## Integration with ssh2

```typescript
// Use parsed config with ssh2
const sshOptions = config.compute('my-server')

conn.connect({
  host: sshOptions.HostName || sshOptions.Host,
  port: parseInt(sshOptions.Port) || 22,
  username: sshOptions.User,
  privateKey: sshOptions.IdentityFile
    ? fs.readFileSync(expandTilde(sshOptions.IdentityFile))
    : undefined,
  agent: sshOptions.ForwardAgent === 'yes'
    ? process.env.SSH_AUTH_SOCK
    : undefined
})
```

## Dependencies

```json
{
  "ssh-config": "^5.0.0"
}
```

Note: `chokidar` already exists in MultiClaude (used by git-head-watcher).

---

## Sources

- npm: ssh-config
- Gemini CLI research (2026-01-08)
