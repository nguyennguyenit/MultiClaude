# Debugging Report: Clipboard Image Paste Bug

**Date:** 2026-01-01
**Issue:** Cannot paste images (screenshots/copied images) into terminal
**Status:** ✅ FIXED

---

## Summary

The clipboard image paste feature fails because xterm.js intercepts paste events and calls `stopPropagation()`, preventing custom handlers registered on `terminal.element` from receiving the event.

---

## Root Cause Analysis

### Current Implementation (Broken)

**File:** `src/renderer/hooks/use-terminal.ts:81`

```typescript
terminal.element?.addEventListener('paste', async (e: ClipboardEvent) => {
  // Handle image paste...
})
```

### Why It Fails

**Evidence from xterm.js source** (`node_modules/@xterm/xterm/lib/xterm.js`):

1. **xterm's handlePasteEvent function:**
```javascript
t.handlePasteEvent = function(e, t, i, s) {
  e.stopPropagation(),  // <-- BLOCKS EVENT PROPAGATION
  e.clipboardData && r(e.clipboardData.getData("text/plain"), t, i, s)
}
```

2. **xterm registers paste handlers on BOTH textarea AND element:**
```javascript
// In _initGlobal():
const e = e => (0,s.handlePasteEvent)(e, this.textarea, ...);
this.register((0,r.addDisposableDomListener)(this.textarea, "paste", e));
this.register((0,r.addDisposableDomListener)(this.element, "paste", e));
```

### Event Flow Analysis

```
DOM Structure:
  div.xterm (terminal.element)
    └── div.xterm-screen
          └── textarea (hidden input, receives focus)
          └── canvas (WebGL rendering)
```

**When user presses Ctrl+V:**
1. Browser dispatches paste event on focused element (textarea)
2. xterm's textarea paste handler fires first (registered during `open()`)
3. xterm calls `stopPropagation()` → blocks bubbling to parent elements
4. Our handler on `terminal.element` never receives the event

**Key insight:** `stopPropagation()` prevents event bubbling from textarea → parent element. Since our handler is on `terminal.element` (a parent), it never fires.

---

## Proof of Concept

| Component | Property | Description |
|-----------|----------|-------------|
| xterm.js | `terminal.textarea` | Hidden `<textarea>` that receives keyboard focus |
| xterm.js | `terminal.element` | Container div wrapping the terminal |
| xterm.js | `handlePasteEvent` | Calls `stopPropagation()`, only handles `text/plain` |

**xterm exposes `textarea` property:**
```typescript
// From @xterm/xterm/typings/xterm.d.ts
readonly textarea: HTMLTextAreaElement | undefined;
```

---

## Solution

**Use capture phase + stopImmediatePropagation:**

```typescript
terminal.element?.addEventListener('paste', async (e: ClipboardEvent) => {
  // Check for image...
  if (!imageItem) return  // Let xterm handle text normally

  e.preventDefault()
  e.stopImmediatePropagation()  // Stop ALL other handlers

  // Handle image...
}, { capture: true })  // Capture phase runs BEFORE bubble phase
```

**Why this works:**
1. `{ capture: true }` - Our handler runs during capture phase (document → target)
2. xterm's handlers run during bubble phase (target → document)
3. `stopImmediatePropagation()` - Stops ALL other handlers, even on same element
4. Image paste is handled; text paste flows through normally

---

## Alternative Solutions

1. **Event Capture Phase:** Use `{ capture: true }` to intercept before xterm
   ```typescript
   terminal.element?.addEventListener('paste', handler, { capture: true })
   ```

2. **Register on textarea:** Direct access to the focused element (recommended)

---

## Related Commits

- `78021f9` fix(clipboard): pass image data from renderer to main process
- `8391a5a` fix(terminal): move clipboard paste handler to xterm element
- `19b509f` feat(terminal): add clipboard image paste to insert file path
- `cd9db49` feat(clipboard): add IPC handler for saving clipboard images

---

## Fix Location

**File:** `src/renderer/hooks/use-terminal.ts`
**Line:** 81
**Change:** `terminal.element?.addEventListener` → `terminal.textarea?.addEventListener`
