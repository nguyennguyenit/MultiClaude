# GitHub Branch Select Clarity Design

Date: 2026-04-02
Status: Draft for review

## Context

The GitHub setup dialog currently shows the base branch step with a native `select` control even when there is only one local branch available. In the common case for a newly initialized repository, that branch is `main`. The UI suggests there should be multiple choices, but opening the control often reveals no meaningful alternatives.

The panel below the selector also reads like an empty white box in some themes because it is rendered as a button with insufficient visual reset and emphasis.

## Problem

Users need to understand two things immediately:

1. Which branch will be pushed.
2. Which area is interactive versus informational.

The current presentation fails both goals because:

- A one-option `select` looks like a broken chooser instead of a resolved choice.
- The lower info block can appear like a blank input area.

## Chosen Approach

When the branch list contains exactly one local branch, replace the native `select` with a visually prominent branch card:

- Show branch icon, branch name, and a short status label.
- Keep the styling clearly selectable/readable, but mark it as fixed for this step.
- Add helper text such as `Only local branch available` so the user understands why there is nothing else to choose.

When the branch list contains multiple local branches, keep a chooser, but increase contrast and visual affordance so the control reads as interactive immediately.

For the lower panel:

- Restyle the `Why push to remote?` trigger so it looks like a deliberate dark info panel.
- Remove any browser-default button appearance that can create a white rectangle.
- Preserve the existing collapsible behavior.

## Scope

In scope:

- `GitHubConnectDialog` rendering for the branch-select step.
- Styling for the base branch control and explanatory panel.
- Small conditional UI changes based on branch count.

Out of scope:

- Changing git branch discovery logic.
- Introducing remote-branch selection.
- Altering push behavior.

## Data Flow

- Continue using the existing local branch list already loaded into dialog state.
- Use `branches.length` to decide between fixed card and chooser UI.
- Continue using `selectedBranch` as the source of truth for the push target.

## Error Handling

- If no local branches are returned, keep the existing synthetic current-branch fallback.
- No changes to error handling or push failure behavior.

## Testing

- Add renderer tests covering:
  - one local branch renders the fixed branch card and helper copy
  - multiple branches render a chooser
  - the informational panel renders with the updated trigger text and no placeholder-like empty content

## Success Criteria

- A user can identify the chosen branch without opening a dropdown when there is only one branch.
- The lower panel no longer resembles a blank text input.
- The multi-branch case still supports selection clearly.
