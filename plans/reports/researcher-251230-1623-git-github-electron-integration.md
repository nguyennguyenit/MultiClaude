# Git/GitHub Integration Patterns for Electron Apps

**Date:** 2025-12-30 | **Type:** Research Report

---

## 1. GitHub CLI (gh) OAuth Authentication

### Recommended: Device Flow via `gh auth login`

```javascript
const { spawn } = require('child_process');

function authenticateGitHub() {
  const auth = spawn('gh', ['auth', 'login', '--web']);

  auth.stdout.on('data', (data) => {
    // Parse device code + verification URL
    // Display to user in Electron UI
  });

  auth.on('close', (code) => {
    if (code === 0) {
      // Auth successful, token stored in system credential store
    }
  });
}
```

**Key Points:**
- `gh` CLI handles OAuth complexity + secure credential storage
- Device code flow: user completes auth in browser
- Prerequisite: `gh` must be installed on user's system
- Check auth status: `gh auth status`

### Alternative: Custom OAuth Flow

- Register GitHub OAuth App → get `client_id` / `client_secret`
- Open BrowserWindow to GitHub auth URL
- Handle redirect to custom URI scheme
- Set `GH_TOKEN` env var for child processes

**Trade-off:** More control but higher complexity; must manage token storage securely.

---

## 2. Git Operations via child_process

### Method Selection

| Method | Shell | Output | Best For |
|--------|-------|--------|----------|
| `spawn` | No | Stream | Long ops, large output, security |
| `exec` | Yes | Buffer | Simple cmds, shell features needed |
| `execFile` | No | Buffer | Safe + buffered output |

### Recommended Pattern: spawn with Array Args

```javascript
const { spawn } = require('child_process');

function gitCommand(args, cwd) {
  return new Promise((resolve, reject) => {
    const git = spawn('git', args, { cwd });
    let stdout = '', stderr = '';

    git.stdout.on('data', d => stdout += d);
    git.stderr.on('data', d => stderr += d);

    git.on('close', code => {
      code === 0 ? resolve(stdout) : reject({ code, stderr });
    });

    git.on('error', reject);
  });
}

// Usage - safe from command injection
await gitCommand(['status', '--porcelain'], '/path/to/repo');
await gitCommand(['commit', '-m', userMessage], repoPath);
```

### Security Rules

1. **Always use array args** - never string concatenation
2. **Never use `shell: true`** unless absolutely required
3. **Validate inputs** - branch names, URLs, commit messages
4. **Forward SSH env vars** for private repo access: `SSH_AUTH_SOCK`, `SSH_AGENT_PID`

---

## 3. Repository Initialization & Remote Setup

### Init + Remote Setup Pattern

```javascript
async function initRepository(path, remoteUrl) {
  await gitCommand(['init'], path);
  await gitCommand(['remote', 'add', 'origin', remoteUrl], path);
  await gitCommand(['fetch', 'origin'], path);
}

async function cloneRepository(url, destination) {
  await gitCommand(['clone', url, destination], process.cwd());
}
```

### Using simple-git Library

```javascript
const simpleGit = require('simple-git');

const git = simpleGit({ baseDir: '/project/path' });

await git.init();
await git.addRemote('origin', 'https://github.com/user/repo.git');
await git.fetch('origin');
await git.checkoutBranch('main', 'origin/main');
```

**simple-git advantages:**
- Promise-based API
- TypeScript support
- Concurrency management
- Covers most git operations

---

## 4. Multi-Project Git Workflow Patterns

### For Desktop App Managing Multiple Repos

**Pattern A: Independent Repos (Polyrepo)**
- Each project = separate git repo
- App tracks list of repo paths
- Parallel status checks via Promise.all

```javascript
async function getMultiRepoStatus(repoPaths) {
  return Promise.all(
    repoPaths.map(async path => ({
      path,
      status: await gitCommand(['status', '--porcelain'], path)
    }))
  );
}
```

**Pattern B: Monorepo with Workspaces**
- Single repo, multiple apps/packages
- Use Turborepo/Nx for build orchestration
- Path-aware CI/CD triggers

### Recommended Structure

```
/projects
  /project-a/.git
  /project-b/.git
  /project-c/.git

# App maintains registry:
{
  "projects": [
    { "name": "project-a", "path": "/projects/project-a" },
    { "name": "project-b", "path": "/projects/project-b" }
  ]
}
```

---

## 5. Git Status Monitoring Best Practices

### File Watcher + Debounced Status

```javascript
const chokidar = require('chokidar');
const { debounce } = require('lodash');

function watchRepository(repoPath, onStatusChange) {
  const updateStatus = debounce(async () => {
    const status = await gitCommand(['status', '--porcelain'], repoPath);
    onStatusChange(parseStatus(status));
  }, 500); // 500ms debounce

  const watcher = chokidar.watch(repoPath, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/package-lock.json',
      '**/*.log'
    ],
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('all', updateStatus);
  return watcher;
}
```

### Status Parsing

```javascript
function parseStatus(porcelain) {
  return porcelain.split('\n').filter(Boolean).map(line => ({
    status: line.substring(0, 2),
    file: line.substring(3),
    staged: line[0] !== ' ' && line[0] !== '?',
    modified: line[1] === 'M',
    untracked: line.startsWith('??')
  }));
}
```

### Performance Tips

1. Use `--porcelain` flag for machine-readable output
2. Debounce aggressively (300-1000ms)
3. Ignore `.git/`, `node_modules/`, lock files
4. Poll fallback for network drives (chokidar unreliable)
5. Consider `git status --short --branch` for branch info

---

## Implementation Recommendations

| Component | Recommendation |
|-----------|----------------|
| Auth | Use `gh auth login` device flow |
| Git Ops | `spawn` with array args OR `simple-git` library |
| Init/Clone | `simple-git` for convenience |
| Multi-project | Registry + parallel Promise.all |
| Monitoring | chokidar + debounce + porcelain parsing |

### Dependencies

```json
{
  "simple-git": "^3.x",
  "chokidar": "^3.x",
  "lodash": "^4.x"
}
```

---

## Unresolved Questions

1. How to handle `gh` CLI not installed? Bundle or prompt user install?
2. Token refresh strategy for long-running sessions?
3. Cross-platform path handling (Windows backslashes)?
4. Handling large repos with slow status commands?
