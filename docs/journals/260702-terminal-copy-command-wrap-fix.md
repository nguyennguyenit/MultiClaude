# Terminal Copy Command Wrap Fix

## Summary

Fixed terminal context-menu Copy for `ck:*` command examples that Claude CLI formats across narrow terminal widths.

## Change

- Added copy-selection normalization in `use-terminal-clipboard`.
- Joins indented continuation rows for copied `ck:*` command examples.
- Preserves ordinary multiline output and unindented command output selections.
- Added regression coverage for the reported `ck:cook ... ad-card-reuse/plan.md --tdd` case.

## Verification

- `npm test -- src/renderer/hooks/__tests__/use-terminal-clipboard.spec.ts`
- `npm run typecheck`
- `npm run lint` passes with 4 pre-existing warnings outside changed files.

## Unresolved Questions

None.
