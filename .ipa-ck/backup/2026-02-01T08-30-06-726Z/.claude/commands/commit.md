---
allowed-tools: Bash(git *)
description: Stage tracked files and create a commit (respects .gitignore)
---

## Context

- Current git status: !`git status`
- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git diff --stat`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -5`

## Rules

1. **NEVER use `git add .` or `git add -A`** - these will fail on gitignored files
2. **Only stage files that are NOT gitignored:**
   - Modified tracked files: use `git add -u` (safe, only updates tracked files)
   - New untracked files: check each with `git check-ignore -q <path>` before adding
3. **For untracked files:** Run `git status --porcelain | grep '^??' | cut -c4-` to list them, then for each file run `git check-ignore -q <file> || git add <file>`
4. **DO NOT push** to remote repository unless explicitly requested

## Task

Based on the above context:
1. Stage modified tracked files with `git add -u`
2. For any untracked files, check if gitignored before adding
3. Create a commit with conventional commit message based on changes
4. Show final `git status` to confirm

Use a single message with multiple tool calls where possible.
