# Brainstorm: Keyboard Shortcuts Fix

## Problem Statement
User yêu cầu sửa và bổ sung phím tắt cho MultiClaude:
1. Thêm `Ctrl+T` cho New Terminal
2. Fix `Alt+Number` không hoạt động khi terminal active (xuất hiện số thay vì switch project)
3. Hiển thị viền nổi bật khi switch terminal
4. Làm nổi bật active terminal so với inactive

## Root Cause Analysis

### Alt+Number và Ctrl+N Issue (CÙNG ROOT CAUSE)
- **Nguyên nhân**: xterm.js bắt keyboard events TRƯỚC window event listener
- `attachCustomKeyEventHandler` trong use-terminal.ts chỉ xử lý Ctrl+V
- Các phím khác return `true` → xterm xử lý tiếp → window listener không nhận được
- Khi terminal focus:
  1. xterm nhận event trước
  2. `attachCustomKeyEventHandler` được gọi
  3. Return `true` → xterm tiếp tục xử lý
  4. Event bubbles lên window NHƯNG đã bị xterm consumed

### Active Terminal Visibility
- **Hiện tại**: Chỉ dùng `box-shadow: inset 0 0 0 2px` - quá subtle
- Không có animation khi switch
- Inactive terminals cùng opacity với active

## Evaluated Approaches

### Approach 1: Alt+Number (Intercept trong xterm) ✅ SELECTED
**Pros:**
- Bắt event tại source, chính xác 100%
- Không conflict với bất kỳ shell nào
- Seamless UX

**Cons:**
- Cần modify use-terminal.ts
- Tight coupling với store

### Approach 2: Alt+Number (Dùng phím khác)
**Pros:**
- Đơn giản, không cần modify xterm handler

**Cons:**
- Breaking change cho users hiện tại
- Ctrl+Number có thể conflict với tmux/vim

### Approach 3: Active Highlight (Glow + Border) ✅ SELECTED
**Pros:**
- Visual distinction mạnh
- Modern, premium look
- Animation khi switch tạo feedback

**Cons:**
- Cần test performance với nhiều terminals

### Approach 4: Active Highlight (Border dày + opacity)
**Pros:**
- Simple CSS

**Cons:**
- Kém aesthetics hơn glow

## Final Recommended Solution

### 1. Ctrl+T for New Terminal
**File:** `src/renderer/hooks/use-keyboard-shortcuts.ts`
- Add handler cho `Ctrl+T` song song với `Ctrl+N`

### 2. Alt+Number Intercept
**File:** `src/renderer/hooks/use-terminal.ts`
- Trong `attachCustomKeyEventHandler`, thêm xử lý Alt+1~9
- Call `useAppStore.getState().setActiveProject()` trực tiếp
- Return `false` để prevent shell từ nhận event

### 3. Glow Effect + Border + Animation
**File:** `src/renderer/styles/globals.css`

```css
/* Active pane focus indicator with glow */
.terminal-pane-active {
  box-shadow:
    inset 0 0 0 2px var(--mc-accent),
    0 0 20px 2px color-mix(in srgb, var(--mc-accent) 30%, transparent);
  animation: terminal-activate 0.3s ease-out;
}

/* Dim inactive terminals for contrast */
.terminal-pane:not(.terminal-pane-active) {
  opacity: 0.85;
}

@keyframes terminal-activate {
  0% {
    box-shadow:
      inset 0 0 0 3px var(--mc-accent),
      0 0 40px 8px color-mix(in srgb, var(--mc-accent) 50%, transparent);
  }
  100% {
    box-shadow:
      inset 0 0 0 2px var(--mc-accent),
      0 0 20px 2px color-mix(in srgb, var(--mc-accent) 30%, transparent);
  }
}
```

## Implementation Considerations

### Files to Modify
1. `src/renderer/hooks/use-keyboard-shortcuts.ts` - Add Ctrl+T
2. `src/renderer/hooks/use-terminal.ts` - Add Alt+1~9 intercept
3. `src/renderer/styles/globals.css` - Update active terminal styles

### Risks
- **Animation performance**: Cần test với 9-12 terminals
- **WebGL context**: Opacity change có thể trigger redraw

### Testing
- Test Alt+1~9 với active terminal
- Test Ctrl+T không conflict với browser new tab
- Verify glow effect trên các themes khác nhau

## Success Metrics
- Alt+Number switch project thành công 100% khi terminal focused
- Ctrl+T tạo terminal mới
- Active terminal dễ dàng phân biệt với inactive
- Animation smooth, không jank

## Next Steps
1. Implement changes trong 3 files
2. Test thủ công với các scenarios
3. Update README keyboard shortcuts section

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Alt+Number handling | Intercept trong xterm | Chính xác nhất, bắt event tại source |
| Active highlight | Glow + border + animation | Premium look, clear distinction |
| Inactive dim | 0.85 opacity | Subtle contrast, không quá harsh |
