---
name: release
description: Repo-local `$release <target>` command for MultiClaude draft-first releases.
argument-hint: "<target>"
---

# MultiClaude Release

Use this skill only inside the MultiClaude repo.

Command grammar:

```text
$release <target>
```

Valid targets:
- `current`
- `main`
- `beta`
- any real branch name

## Workflow

1. Run preview first:

```bash
node "$(git rev-parse --show-toplevel)/scripts/release/release-command.mjs" preview \
  --target <target>
```

2. Parse the JSON response.
3. Stop immediately if:
   - `preflight.ghAuthValid` is `false`
   - `preflight.duplicateTag` is `true`
   - `preflight.duplicateRelease` is `true`
4. If `preflight.cleanTree` is `false`, tell the user the working tree is dirty and ask whether they want to commit the current changes before release.
   - If yes, help them commit first, then rerun preview.
   - If no, stop without executing the release.
5. Ask only for values the preview says are still missing:
   - if `requiresReleaseTypePrompt`, ask whether the release is `stable` or `prerelease`
   - if `requiresVersionPrompt`, offer `suggestedVersion` when present and ask the user to confirm or replace it
6. Re-run preview with the chosen `--release-type` and `--version` before execution:

```bash
node "$(git rev-parse --show-toplevel)/scripts/release/release-command.mjs" preview \
  --target <target> \
  --release-type <stable|prerelease> \
  --version <version>
```

7. If the refreshed preview says `requiresBranchSwitch` is `true`, tell the user which branch the command will switch to before execution.
8. If the refreshed preview says `requiresCustomStableConfirm` is `true`, ask for one extra explicit confirmation.
9. Show the final execution summary:
   - target
   - resolved branch
   - version
   - release type
   - whether the command will switch branches
10. Only after the user confirms, run execute:

```bash
node "$(git rev-parse --show-toplevel)/scripts/release/release-command.mjs" execute \
  --target <target> \
  --version <version> \
  --release-type <stable|prerelease> \
  --confirm
```

11. Add `--confirm-custom-stable` when the refreshed preview flagged `requiresCustomStableConfirm`.
12. Report the returned draft release URL, workflow run URL, asset summary, and any `branchPushWarning`. Stop at draft-ready. Do not publish the GitHub release.

## Guardrails

- Do not skip preview.
- Do not infer custom-branch versions automatically.
- Do not hide branch switching.
- Do not execute the release while the working tree is dirty.
- Do not run execute without explicit final confirmation.
- Draft-first only. Publishing stays manual after assets land.
