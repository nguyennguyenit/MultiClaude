# Fix Terminal Scroll Issues

## Problems

| Issue | Symptom | Root Cause |
|-------|---------|------------|
| Screen Jumping | Terminal clear & redraw khi switch project | `terminal.refresh()` trong visibility effect |
| Auto-scroll | User đang đọc history bị kéo xuống bottom | xterm.js default behavior + thiếu smart scroll |

## Files
- `src/renderer/hooks/use-terminal.ts`

## Implementation

### Fix 1: Screen Jumping (line 679-688)

```diff
const restoreScrollAndCursor = () => {
  if (cancelled || disposedRef.current || !terminalRef.current) return

- // 1. Force re-render all rows FIRST (may affect scroll)
- terminalRef.current.refresh(0, terminalRef.current.rows - 1)
-
- // 2. Restore scroll position AFTER refresh using xterm.js API
+ // 1. Restore scroll position (no refresh needed - prevents screen jumping)
  if (savedViewportY !== null && savedViewportY > 0) {
    terminalRef.current.scrollToLine(savedViewportY)
  }

- // 3. Force cursor re-render...
+ // 2. Force cursor re-render...
```

### Fix 2: Smart Scroll (line 369-386)

```diff
const write = useCallback((data: string) => {
+ // Save scroll state BEFORE write (xterm auto-scrolls on write)
+ const wasAtBottom = isAtBottomRef.current
+ const savedY = terminalRef.current?.buffer.active.viewportY ?? 0
+
  terminalRef.current?.write(data)

+ // If user was reading history, restore their scroll position
+ if (!wasAtBottom && terminalRef.current && savedY >= 0) {
+   terminalRef.current.scrollToLine(savedY)
+ }

  // Auto cursor restore: after output settles...
```

## Tasks
- [x] Remove `terminal.refresh()` từ restoreScrollAndCursor()
- [x] Add smart scroll logic vào write()
- [ ] Test: switch projects - không còn jumping
- [ ] Test: scroll lên đọc history - không bị kéo xuống
- [ ] Test: ở bottom - vẫn auto-scroll bình thường

## Success Criteria
- Không screen jumping khi switch project
- User scroll lên đọc history không bị interrupt
- Ở bottom vẫn follow output mới
- Cursor vẫn visible sau switch
