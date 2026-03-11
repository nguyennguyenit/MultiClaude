# Zustand State Batching & Atomic Updates Research

**Research Date:** 2026-01-14
**Focus:** React state batching, Zustand atomic updates, race condition prevention

## Executive Summary

Zustand handles state updates through React 18's automatic batching and `useSyncExternalStore`. Key finding: **Multiple sequential `set()` calls are NOT guaranteed atomic** - use single consolidated `set()` with functional updates to prevent race conditions.

## 1. Zustand Multiple setState Handling

### Current Behavior (v4/v5)
- **No Built-in Transactions:** Zustand lacks official transaction API
- **Sequential `set()` Calls:** Each triggers independent state update + subscriber notification
- **React Batching:** Multiple `set()` calls in same React context → single re-render (React 18+)
- **Important:** Batching prevents multiple renders but **doesn't guarantee atomic state consistency** between calls

### Update Mechanisms
```typescript
// WRONG - Race condition risk
set({ cursorX: 100 });
set({ cursorY: 200 });
// Another update could interleave here

// CORRECT - Atomic update
set({ cursorX: 100, cursorY: 200 });

// BEST - Functional update with state dependency
set((state) => ({ cursorX: newX, cursorY: newY, timestamp: Date.now() }));
```

## 2. Atomic State Updates Best Practices

### Single Action Pattern (Recommended)
```typescript
const useStore = create((set) => ({
  cursorX: 0,
  cursorY: 0,
  visible: false,

  // ✅ Bundle related state in single action
  updateCursor: (x, y, visible) => set({
    cursorX: x,
    cursorY: y,
    visible
  }),

  // ❌ Avoid separate actions for related state
  setCursorX: (x) => set({ cursorX: x }),
  setCursorY: (y) => set({ cursorY: y }),
}));
```

### Functional Updates (Always Use)
```typescript
// ✅ Functional form - always gets latest state
set((state) => ({ count: state.count + 1 }));

// ❌ Direct access - can use stale state
const current = get().count;
set({ count: current + 1 });
```

### Complex State with Immer Middleware
```typescript
import { immer } from 'zustand/middleware/immer';

const useStore = create(immer((set) => ({
  nested: { cursor: { x: 0, y: 0 } },

  updateCursor: (x, y) => set((state) => {
    // Write "mutative" code safely
    state.nested.cursor.x = x;
    state.nested.cursor.y = y;
  }),
})));
```

## 3. React 18+ Automatic Batching

### Batching Scope
| Context | React 17 | React 18 |
|---------|----------|----------|
| Event handlers | ✅ Batched | ✅ Batched |
| `setTimeout` | ❌ Multiple renders | ✅ Batched |
| Promises/`async` | ❌ Multiple renders | ✅ Batched |
| Native events | ❌ Multiple renders | ✅ Batched |

### Zustand Integration
- Zustand v4+ uses `useSyncExternalStore` (React 18 API)
- Prevents "tearing" (components seeing different state versions in single render)
- **Batching = Performance optimization, NOT atomicity guarantee**

### Edge Cases
```typescript
// React 18 batches these into 1 render
setTimeout(() => {
  useStore.getState().setCursorX(10);
  useStore.getState().setCursorY(20);
}, 100);

// Still risky - intermediate state exists between calls
// Better: single action
setTimeout(() => {
  useStore.getState().updateCursor(10, 20, true);
}, 100);
```

## 4. Race Conditions Between Sequential `set()` Calls

### Common Race Condition Scenarios

**Scenario 1: Async Closures (Stale State)**
```typescript
// ❌ WRONG - stale state in closure
const asyncUpdate = async () => {
  const current = get().count;  // Captured value
  await fetch('/api');
  set({ count: current + 1 });  // May be stale
};

// ✅ CORRECT - functional update
const asyncUpdate = async () => {
  await fetch('/api');
  set((state) => ({ count: state.count + 1 }));
};
```

**Scenario 2: Interleaved Updates**
```typescript
// ❌ WRONG - sequential calls, not atomic
const updateCursor = (x, y) => {
  set({ cursorX: x });
  // Another component/effect could read inconsistent state here
  set({ cursorY: y });
};

// ✅ CORRECT - single atomic update
const updateCursor = (x, y) => set({ cursorX: x, cursorY: y });
```

**Scenario 3: Non-React Context Updates**
```typescript
// Outside React event loop - use manual batching
import { unstable_batchedUpdates } from 'react-dom';

websocket.on('message', (data) => {
  unstable_batchedUpdates(() => {
    useStore.getState().updateCursor(data.x, data.y);
    useStore.getState().setVisible(data.visible);
  });
});
```

## 5. Pattern for Combining Related State Updates

### Design Principle
**Bundle logically related state fields in single action to maintain consistency**

### Implementation Patterns

**Pattern A: Direct Object Update**
```typescript
const useTerminalStore = create((set) => ({
  cursorX: 0,
  cursorY: 0,
  cursorVisible: false,

  // All cursor-related state in one action
  setCursor: (x, y, visible) => set({
    cursorX: x,
    cursorY: y,
    cursorVisible: visible
  }),
}));
```

**Pattern B: Functional Update with Dependencies**
```typescript
const useTerminalStore = create((set) => ({
  cursorX: 0,
  cursorY: 0,
  lastMoveTime: 0,

  moveCursor: (x, y) => set((state) => ({
    cursorX: x,
    cursorY: y,
    lastMoveTime: Date.now(),
  })),
}));
```

**Pattern C: Transient Updates (High-Frequency)**
```typescript
// For cursor position (updates 60+ fps), bypass React render
const unsubscribe = useStore.subscribe(
  (state) => state.cursorX,
  (x) => {
    // Directly update DOM, skip React
    cursorElement.style.left = `${x}px`;
  }
);
```

## Key Recommendations

1. **Always bundle related state** (cursor x/y/visible) in single `set()` call
2. **Use functional updates** `set((state) => ...)` when depending on current state
3. **Avoid sequential `set()` calls** for interdependent state - creates intermediate inconsistent states
4. **React 18 batching ≠ atomicity** - still need single `set()` for consistency
5. **High-frequency updates** - consider transient updates via `.subscribe()` to bypass React

## Unresolved Questions

None - research complete for cursor display fix implementation.

---

## Sources

- [Zustand v5 Migration Guide](https://github.com/pmndrs/zustand/blob/main/docs/guides/v5-migration-guide.md)
- [React 18 Automatic Batching](https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching)
- [Zustand Official Docs](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [React 18 Batching Discussion](https://github.com/reactwg/react-18/discussions/21)
- [Zustand + React 18 Issues](https://github.com/pmndrs/zustand/issues/1008)
- [Leapcell Zustand Performance (2025)](https://leapcell.io/blog/zustand-vs-redux-2025)
