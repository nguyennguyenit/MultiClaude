# Brainstorm: Root Cause Analysis - Cursor Display Issue on Project Switch

## Problem Statement

Khi switch project, cursor không hiển thị đúng ở terminal của project được switch về. Vấn đề xảy ra với cả việc switch nhiều project, không chỉ switch 2 project qua lại.

## Architecture Analysis

### Current Implementation (Single-Parent Pattern)

```
terminal-grid.tsx
├── div (single parent container)
│   ├── div[project-a] style={{ display: isActive ? 'flex' : 'none' }}
│   │   └── TerminalPane → TerminalView → xterm.js
│   ├── div[project-b] style={{ display: isActive ? 'flex' : 'none' }}
│   │   └── TerminalPane → TerminalView → xterm.js
│   └── ...
```

### Data Flow khi Switch Project

```
User clicks Project B
    ↓
handleSelectProject(id) [App.tsx:77-108]
    ↓
setActiveProject(id)     ← Zustand update
setActiveTerminal(newProjectTerminals[0]?.id)
    ↓
React re-render
    ↓
terminal-grid.tsx:
  - group.isActive changes
  - hidden prop changes: hidden={!group.isActive || terminal.id !== activeTerminalId}
    ↓
terminal-view.tsx:
  - isActive prop changes
  - useEffect [line 79-84]: if (isActive) { focus(); fit() }
    ↓
use-terminal.ts:
  - isActive/isHidden ref updates
  - WebGL toggle debounce (50ms)
```

## Root Cause Identification

### Root Cause #1: Race Condition trong Focus/Fit Timing

**Location:** `terminal-view.tsx:79-84`

```tsx
useEffect(() => {
  if (isActive) {
    focus()
    fit()
  }
}, [isActive, focus, fit])
```

**Problem:**
- `focus()` và `fit()` được gọi ngay khi `isActive` = true
- Nhưng WebGL toggle có debounce 50ms (`use-terminal.ts:554`)
- Khi terminal unhide, WebGL đang được load lại
- `focus()` có thể chạy TRƯỚC khi WebGL addon hoàn thành → cursor không render đúng

**Evidence:**
- `WEBGL_TOGGLE_DEBOUNCE = 50` (use-terminal.ts:12)
- WebGL load trong `requestAnimationFrame` (use-terminal.ts:527)

### Root Cause #2: Missing Focus Trigger khi Project Switch

**Location:** `terminal-view.tsx:79-84`

**Problem:**
- `isActive` chỉ trigger focus khi nó THAY ĐỔI từ false → true
- Khi switch từ Project A → B → A:
  - Lần đầu A→B: Terminal B's isActive: false→true ✅
  - Lần sau B→A: Terminal A's isActive đã là true (vẫn mounted, chỉ hidden) → **KHÔNG trigger focus lại**

**Scenario phức tạp (3+ projects):**
```
A(active) → B → C → A
- A: isActive false→true→false→true (nhưng component KHÔNG re-mount)
- Khi quay lại A, React comparison có thể miss focus trigger
```

### Root Cause #3: Hidden State vs Display State Mismatch

**Location:** `terminal-grid.tsx:181`

```tsx
hidden={!group.isActive || terminal.id !== activeTerminalId}
```

**Problem:**
- `hidden` prop có 2 conditions: project active AND terminal active
- CSS `display: none` chỉ check project active
- Có thể xảy ra: project visible (display: flex) nhưng terminal vẫn `hidden=true`

**Scenario:**
1. Project A có 2 terminals (T1, T2), T1 active
2. Switch to Project B
3. Switch back to Project A, nhưng `activeTerminalId` chưa được update kịp
4. T1 visible nhưng `hidden=true` → WebGL không load, cursor không hiển thị

### Root Cause #4: Stale activeTerminalId khi Switch Project

**Location:** `App.tsx:103-105`

```tsx
const { terminals } = useAppStore.getState()
const newProjectTerminals = terminals.filter(t => t.projectId === id)
setActiveTerminal(newProjectTerminals[0]?.id || null)
```

**Problem:**
- `setActiveTerminal` được gọi SAU `setActiveProject`
- Có thể có 1 render cycle giữa 2 updates
- Trong render cycle đó, `activeProjectId` = new project, nhưng `activeTerminalId` = old terminal

## Proposed Solutions

### Solution 1: Atomic State Update (Recommended)

**Approach:** Bundle `activeProjectId` và `activeTerminalId` update trong 1 action

```tsx
// app-store.ts
switchToProject: (projectId: string, terminalId?: string) =>
  set((state) => {
    const projectTerminals = state.terminals.filter(t => t.projectId === projectId)
    return {
      activeProjectId: projectId,
      activeTerminalId: terminalId ?? projectTerminals[0]?.id ?? null
    }
  })
```

**Pros:**
- Single render cycle
- No intermediate inconsistent state
- Simple to implement

**Cons:**
- Minor refactor needed

### Solution 2: Focus on Visibility Change (Not Just Active Change)

**Approach:** Track previous hidden state, trigger focus when transitioning from hidden→visible

```tsx
// use-terminal.ts - new effect
const prevHiddenRef = useRef(isHidden)

useEffect(() => {
  const wasHidden = prevHiddenRef.current
  prevHiddenRef.current = isHidden

  // Trigger focus when transitioning from hidden to visible
  if (wasHidden && !isHidden && isActive) {
    // Wait for WebGL to stabilize
    setTimeout(() => {
      focus()
      fit()
    }, WEBGL_TOGGLE_DEBOUNCE + 10)
  }
}, [isHidden, isActive, focus, fit])
```

**Pros:**
- Handles all visibility transitions correctly
- Works with multi-project switching

**Cons:**
- Additional timeout delay
- More complex logic

### Solution 3: WebGL-Aware Focus

**Approach:** Focus after WebGL addon is fully loaded

```tsx
// use-terminal.ts - modify WebGL toggle effect
useEffect(() => {
  // ... existing WebGL toggle logic ...

  const toggleWebGL = () => {
    if (needsWebGL && !hasWebGL) {
      webglLoadingRef.current = true
      requestAnimationFrame(() => {
        // ... load WebGL ...
        webglLoadingRef.current = false

        // Focus after WebGL loaded
        if (isActiveRef.current && !isHiddenRef.current) {
          terminalRef.current?.focus()
        }
      })
    }
  }
}, [isActive, isHidden])
```

**Pros:**
- Guaranteed cursor visibility after WebGL init
- No arbitrary timeouts

**Cons:**
- Focus tied to WebGL lifecycle
- May cause multiple focus calls

### Solution 4: Cursor Visibility Check + Forced Refresh

**Approach:** After focus, verify cursor is visible, refresh if not

```tsx
// use-terminal.ts
const ensureCursorVisible = useCallback(() => {
  if (!terminalRef.current) return

  // Force cursor block to redraw
  terminalRef.current.refresh(
    terminalRef.current.buffer.active.cursorY,
    terminalRef.current.buffer.active.cursorY
  )
  terminalRef.current.focus()
}, [])
```

**Pros:**
- Direct fix for cursor visibility
- Works regardless of rendering mode

**Cons:**
- Extra refresh call
- Treating symptom not cause

## Recommended Approach

### Phase 1: Immediate Fix (Solution 1 + 2)

1. **Atomic state update** để loại bỏ race condition giữa project/terminal switch
2. **Hidden→Visible focus trigger** để đảm bảo focus được gọi khi terminal trở nên visible

### Phase 2: Robustness (Solution 3)

3. **WebGL-aware focus** để đảm bảo cursor render sau khi WebGL hoàn thành

### Implementation Priority

| Priority | Solution | Effort | Impact |
|----------|----------|--------|--------|
| P0 | Atomic state update | Low | High |
| P1 | Hidden→Visible focus trigger | Medium | High |
| P2 | WebGL-aware focus | Medium | Medium |
| P3 | Cursor visibility check | Low | Low |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Focus conflicts | Medium | Low | Debounce focus calls |
| WebGL init timing | Low | Medium | Fallback to canvas |
| Performance | Low | Low | Minimal overhead |
| Regression | Low | Medium | E2E test coverage |

## Success Criteria

1. Cursor hiển thị đúng khi switch từ Project A → B
2. Cursor hiển thị đúng khi switch A → B → C → A (3+ projects)
3. Cursor hiển thị đúng khi switch terminal trong cùng project
4. Scroll position preserved
5. No visible flicker hoặc delay

## Next Steps

1. Implement atomic state update (Solution 1)
2. Add hidden→visible focus trigger (Solution 2)
3. Test với 3+ projects
4. Add E2E test coverage cho project switching

## Unresolved Questions

1. Có cần disable WebGL toggle debounce khi switching projects không?
2. Có nên add visual loading indicator trong khi WebGL đang load không?
3. Focus behavior khi user đang type có bị interrupt không?
