# @dnd-kit Grid Swap Research

## 1. Minimal Grid Setup

**Core packages:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

**Basic structure:**
```jsx
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSwappingStrategy, arraySwap, useSortable } from '@dnd-kit/sortable';

function GridLayout() {
  const [items, setItems] = useState([
    { id: '1', text: 'A' },
    { id: '2', text: 'B' },
    { id: '3', text: 'C' },
    { id: '4', text: 'D' }
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);
    setItems(arraySwap(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={rectSwappingStrategy}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {items.map(item => <GridItem key={item.id} id={item.id} text={item.text} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function GridItem({ id, text }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {text}
    </div>
  );
}
```

**Key points:**
- Use CSS Grid/Flexbox for visual 2D layout
- SortableContext takes flat array of IDs (not nested 2D array)
- `rectSwappingStrategy` handles spatial calculations for grid

## 2. DndContext + SortableContext with 2D Grid

**Architecture:**
- `DndContext` - Top-level provider, manages sensors, collision detection, drag handlers
- `SortableContext` - Container for sortable items, applies strategy (e.g., `rectSwappingStrategy`)
- `useSortable` - Hook for individual grid items, provides drag attributes/listeners

**2D Grid handling:**
- Items stored as 1D array: `[{id: '0-0'}, {id: '0-1'}, {id: '1-0'}, {id: '1-1'}]`
- Visual layout via CSS: `gridTemplateColumns: 'repeat(cols, 1fr)'`
- Strategy (`rectSwappingStrategy`) calculates spatial positions automatically
- ID convention: `${row}-${col}` or sequential IDs

**Critical:** SortableContext `items` prop requires array of unique IDs matching `useSortable({ id })` values. Order must match DOM render order.

## 3. Sensors Available

**Built-in sensors:**
- `PointerSensor` - Mouse/touch/stylus (default, unified for touch devices)
- `MouseSensor` - Mouse only
- `TouchSensor` - Touch only
- `KeyboardSensor` - Arrow keys for accessibility (default)

**Configuration example:**
```jsx
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,  // 5px movement before drag starts
      // OR
      delay: 250,   // 250ms hold before drag starts (mutually exclusive)
      tolerance: 5  // pixels allowed during delay
    }
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates  // Grid-aware keyboard nav
  })
);
```

**Default:** PointerSensor + KeyboardSensor (no config needed for basic use).

## 4. Swap Strategy Implementation

**Key difference:**
- `rectSortingStrategy` - Items shift/reorder (A→B, B→C, C shifts right)
- `rectSwappingStrategy` - Items swap positions (A↔B direct exchange)

**Swap implementation:**
```jsx
import { rectSwappingStrategy, arraySwap } from '@dnd-kit/sortable';

<SortableContext strategy={rectSwappingStrategy} items={itemIds}>
  {/* grid items */}
</SortableContext>

const handleDragEnd = (event) => {
  const { active, over } = event;
  if (!over) return;

  const oldIdx = items.findIndex(i => i.id === active.id);
  const newIdx = items.findIndex(i => i.id === over.id);

  // arraySwap utility handles swap logic
  setItems(arraySwap(items, oldIdx, newIdx));
};
```

**Note:** `arraySwap` introduced in recent versions specifically for swap strategy. For older versions, manual swap:
```js
const newItems = [...items];
[newItems[oldIdx], newItems[newIdx]] = [newItems[newIdx], newItems[oldIdx]];
setItems(newItems);
```

## 5. CSS for Drag Overlay/Ghost

**DragOverlay component:**
```jsx
import { DragOverlay } from '@dnd-kit/core';

function App() {
  const [activeId, setActiveId] = useState(null);

  return (
    <DndContext onDragStart={(e) => setActiveId(e.active.id)} onDragEnd={() => setActiveId(null)}>
      {/* SortableContext + items */}

      <DragOverlay>
        {activeId ? <ItemPreview id={activeId} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

**CSS considerations:**
- DragOverlay removes element from normal flow, positions relative to viewport
- Default `zIndex: 999` (customizable via prop)
- No special CSS required - component handles positioning
- Transform applied automatically: `translate3d(x, y, 0)`

**Styling tips:**
```jsx
<DragOverlay
  className="drag-overlay"  // Custom wrapper class
  style={{ width: 200 }}    // Inline styles
  dropAnimation={{
    duration: 200,
    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)'
  }}
>
  {/* Preview content with optional opacity for ghost effect */}
  {activeId ? <div style={{ opacity: 0.8 }}><Item id={activeId} /></div> : null}
</DragOverlay>
```

**Pattern:** Keep DragOverlay mounted, conditionally render children. Render same presentational component in grid (wrapped with useSortable) and overlay (unwrapped).

## 6. react-resizable-panels Compatibility

**Known issues:**
- GitHub issue #126 reports drag handle conflicts when reordering panels with dnd-kit
- Panel IDs don't update after reorder, breaking drag handles
- No official integration guide

**Workaround approach:**
1. Use dnd-kit for panel reordering (swap panel order in state)
2. Force remount panels after reorder (key prop with unique ID)
3. Separate drag handles - one for resize (react-resizable-panels), one for reorder (dnd-kit)

**Example pattern:**
```jsx
<PanelGroup direction="horizontal">
  {panels.map((panel, idx) => (
    <Panel key={`${panel.id}-${idx}`} minSize={20}>
      <div {...dragHandleProps}>⋮⋮</div> {/* dnd-kit handle */}
      {panel.content}
    </Panel>
  ))}
</PanelGroup>
```

**Verdict:** Not seamless. Requires careful state management and key forcing. Consider alternative: single library handling both (e.g., react-grid-layout with resize+drag).

## 7. Bundle Size Impact

**Official stats:**
- `@dnd-kit/core` - ~10kb minified (no external deps)
- Gzipped size - not documented in search results
- `@dnd-kit/sortable` - additional ~few kb (depends on version)

**Tree-shaking:**
- ES modules, well-suited for tree-shaking
- Modular architecture - import only needed sensors/strategies
- Built on React context/hooks (no heavy deps)

**Comparison:**
- react-beautiful-dnd - ~30kb+ (heavier, HTML5 DnD API)
- react-dnd - ~20kb+ (HTML5 DnD API wrapper)
- dnd-kit - lightest modern option

**Practical impact:** Minimal. Core + sortable <15kb minified total. Negligible for terminal app.

## 8. Known Issues with xterm.js/WebGL

**Search findings:**
- No documented conflicts between dnd-kit + xterm.js + WebGL
- No GitHub issues reporting incompatibilities
- xterm.js uses canvas/WebGL rendering; dnd-kit uses DOM events

**Potential concerns:**
1. **Pointer event capture** - xterm.js canvas may consume pointer events
   - Mitigation: Use drag handle outside terminal canvas area
   - PointerSensor activation constraint (5px distance) prevents accidental drags

2. **Performance** - WebGL render during drag could cause jank
   - dnd-kit uses `transform: translate3d()` (GPU-accelerated)
   - Likely minimal impact unless rendering heavy terminal output during drag

3. **Event bubbling** - Terminal may stopPropagation on pointer events
   - Test: Attach dnd-kit listeners to wrapper div, not terminal container

**Recommendation:**
- Wrap xterm.js in non-draggable container
- Apply `useSortable` to parent grid cell, not terminal element
- Use separate drag handle (e.g., titlebar) to avoid terminal pointer conflicts

```jsx
<GridCell {...sortableProps}>
  <div className="drag-handle" {...listeners}>☰</div>  {/* Drag here */}
  <XTermWrapper>
    <Terminal />  {/* Not draggable directly */}
  </XTermWrapper>
</GridCell>
```

## Performance Notes

**Smooth animations:**
- Built for 60fps with `translate3d` + `scale` (no repaint)
- Lazy calculation of positions (only on drag start)

**Known limits:**
- 500+ items - laggy on non-virtualized grids
- `getBoundingClientRect` bottleneck during measuring
- Solution: Virtualization (react-window/react-virtual) or limit grid size

**Terminal grid:** Likely <20 terminals per grid. Performance should be excellent.

## Code Example: Terminal Grid Swap

```jsx
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSwappingStrategy, arraySwap, useSortable } from '@dnd-kit/sortable';
import { Terminal } from '@xterm/xterm';

function TerminalGrid() {
  const [panes, setPanes] = useState([
    { id: 'term-1', title: 'Terminal 1' },
    { id: 'term-2', title: 'Terminal 2' },
    { id: 'term-3', title: 'Terminal 3' },
    { id: 'term-4', title: 'Terminal 4' }
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = panes.findIndex(p => p.id === active.id);
    const newIdx = panes.findIndex(p => p.id === over.id);
    setPanes(arraySwap(panes, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={panes.map(p => p.id)} strategy={rectSwappingStrategy}>
        <div className="terminal-grid">
          {panes.map(pane => <TerminalPane key={pane.id} {...pane} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function TerminalPane({ id, title }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="terminal-pane">
      <div className="titlebar" {...attributes} {...listeners}>
        <span>{title}</span>
        <span className="drag-icon">⋮⋮</span>
      </div>
      <div className="terminal-container">
        <XTerminalComponent />  {/* Not directly draggable */}
      </div>
    </div>
  );
}
```

**CSS:**
```css
.terminal-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  height: 100vh;
}

.terminal-pane {
  border: 1px solid #333;
  display: flex;
  flex-direction: column;
}

.titlebar {
  background: #222;
  padding: 8px;
  cursor: grab;
  user-select: none;
}

.titlebar:active {
  cursor: grabbing;
}

.terminal-container {
  flex: 1;
  pointer-events: auto; /* Terminal gets events, not drag */
}
```

## Sources

- [Overview - @dnd-kit Documentation](https://docs.dndkit.com)
- [Sortable Context - @dnd-kit Documentation](https://docs.dndkit.com/presets/sortable/sortable-context)
- [Sensors - @dnd-kit Documentation](https://docs.dndkit.com/api-documentation/sensors)
- [Drag Overlay - @dnd-kit Documentation](https://docs.dndkit.com/api-documentation/draggable/drag-overlay)
- [GitHub - clauderic/dnd-kit](https://github.com/clauderic/dnd-kit)
- [rectSwappingStrategy Grid Ordering Discussion #485](https://github.com/clauderic/dnd-kit/discussions/485)
- [Grid Swap Example - react-dndkit-eg](https://github.com/shubhadip/react-dndkit-eg/blob/master/src/components/gridSwapEg/index.js)
- [Reordering panels Issue #126 - react-resizable-panels](https://github.com/bvaughn/react-resizable-panels/issues/126)
- [Top 5 Drag-and-Drop Libraries for React in 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
- [Extremely poor performance Issue #943](https://github.com/clauderic/dnd-kit/issues/943)

## Unresolved Questions

1. **Exact gzipped size** - Bundlephobia didn't load full data. Estimate: 4-6kb gzipped based on 10kb minified.
2. **react-resizable-panels integration** - No official solution. May require custom panel component with stable IDs.
3. **xterm.js pointer conflicts** - No reported issues, but untested in production. Recommend prototype test.
