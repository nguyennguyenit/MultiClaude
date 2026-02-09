# Brainstorm: Terminal Auto Copy/Paste Feature

**Date:** 2025-12-31
**Status:** Agreed
**Priority:** Enhancement

---

## Problem Statement

User cần tính năng tự động copy/paste trên terminal để cải thiện UX:
1. **Auto-copy**: Khi bôi đen text → tự động copy vào clipboard
2. **Quick-paste**: Khi right-click → paste ngay từ clipboard (không hiện menu)

## Requirements

| Requirement | Decision |
|-------------|----------|
| Copy timing | Khi thả chuột (mouseup) |
| Paste behavior | Paste ngay, không context menu |
| Visual feedback | Không cần toast/notification |
| Selection after copy | Giữ nguyên |

## Evaluated Approaches

### Approach 1: Native xterm.js Events ✅ **RECOMMENDED**

**Implementation:**
```typescript
// use-terminal.ts - trong initTerminal()

// Auto-copy on selection complete (mouseup)
terminal.element?.addEventListener('mouseup', async () => {
  const selection = terminal.getSelection()
  if (selection) {
    await navigator.clipboard.writeText(selection)
  }
})

// Right-click paste (prevent context menu)
terminal.element?.addEventListener('contextmenu', async (e) => {
  e.preventDefault()
  const text = await navigator.clipboard.readText()
  terminal.paste(text)
})
```

**Pros:**
- Đơn giản, ~15 lines code
- Zero dependencies thêm
- Full control
- Dễ maintain

**Cons:**
- Không dùng official addon (nhưng addon không hỗ trợ auto-copy)

### Approach 2: ClipboardAddon + Custom Code

**Implementation:**
- Import `@xterm/addon-clipboard`
- Configure cho keybindings
- Vẫn cần custom code cho selection → copy

**Pros:**
- Dùng official addon

**Cons:**
- Addon không hỗ trợ auto-copy on selection
- Thêm dependency không cần thiết
- Vẫn cần custom code → phức tạp hơn Approach 1

### Approach 3: onSelectionChange Event

**Implementation:**
```typescript
terminal.onSelectionChange(() => {
  const selection = terminal.getSelection()
  if (selection) navigator.clipboard.writeText(selection)
})
```

**Pros:**
- Dùng xterm event

**Cons:**
- Fire liên tục khi đang kéo selection → performance issue
- Không phân biệt selection start vs end
- Không recommended

---

## Final Recommended Solution

**Approach 1: Native Events** với implementation trong `use-terminal.ts`

### Implementation Location

File: `src/renderer/hooks/use-terminal.ts`

Location: Trong hàm `initTerminal()`, sau khi `terminal.open(containerRef.current)`

### Technical Details

1. **Clipboard API**: Dùng `navigator.clipboard` (modern async API)
2. **Event handling**: `mouseup` cho copy, `contextmenu` cho paste
3. **Error handling**: Wrap trong try-catch để handle permissions denied
4. **No cleanup needed**: Event listeners tự cleanup khi terminal dispose

### Code Changes

```diff
// use-terminal.ts
+ // Auto-copy on selection complete
+ terminal.element?.addEventListener('mouseup', async () => {
+   const selection = terminal.getSelection()
+   if (selection) {
+     try {
+       await navigator.clipboard.writeText(selection)
+     } catch {
+       // Clipboard permission denied - ignore silently
+     }
+   }
+ })
+
+ // Right-click paste
+ terminal.element?.addEventListener('contextmenu', async (e) => {
+   e.preventDefault()
+   try {
+     const text = await navigator.clipboard.readText()
+     if (text) terminal.paste(text)
+   } catch {
+     // Clipboard permission denied - ignore silently
+   }
+ })
```

---

## Implementation Considerations

### Security
- `navigator.clipboard` yêu cầu secure context ✅ (Electron đã handle)
- Electron renderer process có quyền clipboard mặc định ✅

### Performance
- `mouseup` event chỉ fire 1 lần khi thả chuột → OK
- Clipboard operations async → không block UI

### Edge Cases
1. **Empty selection**: Check `if (selection)` trước khi copy
2. **Clipboard empty**: Check `if (text)` trước khi paste
3. **Permission denied**: Silent fail với try-catch
4. **Double-click select word**: Hoạt động bình thường

### Testing Scenarios
- [ ] Select text → verify clipboard contains text
- [ ] Right-click → verify paste works
- [ ] Empty clipboard → right-click should do nothing
- [ ] Click without selecting → should not overwrite clipboard

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Clipboard permission denied | Low | Low | Silent fail, Electron default allows |
| Conflict with existing keybindings | Low | Low | This is additive, not replacing |
| Performance với large selection | Very Low | Low | Clipboard API handles efficiently |

---

## Success Metrics

- Auto-copy hoạt động với mọi selection trong terminal
- Right-click paste hoạt động instant
- Không có lag/delay perceivable
- Không conflict với existing features

---

## Next Steps

1. Implement code changes trong `use-terminal.ts`
2. Test các scenarios
3. Verify không conflict với existing keybindings (Ctrl+C/V)

---

## Estimated Effort

**Complexity:** Low
**Files changed:** 1 (`src/renderer/hooks/use-terminal.ts`)
**Lines of code:** ~20 lines

---

*Report generated: 2025-12-31 23:14*
