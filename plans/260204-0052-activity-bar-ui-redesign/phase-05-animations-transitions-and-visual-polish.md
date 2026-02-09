# Phase 05: Animations, Transitions, and Visual Polish

## Context Links

- [Globals CSS](/home/plateau/Desktop/Claude Code/MultiClaude/src/renderer/styles/globals.css)
- [Phase 03](./phase-03-activity-bar-component-with-view-switching.md)

## Overview

- **Priority:** P2
- **Status:** pending
- **Effort:** 1h
- **Depends on:** Phases 01-04

Add smooth animations, hover effects, and visual polish to Activity Bar.

## Key Insights

- VS Code uses ~200ms transitions for sidebar
- Hidden state needs hover reveal animation
- Active indicator should have subtle pulse on switch
- Badge should animate when count changes
- Terminal UI style needs ASCII-compatible styling

## Requirements

### Functional

- FR-01: Smooth 200ms width transition between states
- FR-02: Hidden state hover zone reveals bar with slide-in
- FR-03: Active indicator has highlight animation on switch
- FR-04: Badge pulses briefly when count changes

### Non-functional

- NFR-01: Animations respect prefers-reduced-motion
- NFR-02: No layout shift during transitions
- NFR-03: GPU-accelerated transforms where possible

## Architecture

```
Animation Breakdown:

1. Width Transition (collapsed ↔ expanded)
   - Property: width
   - Duration: 200ms
   - Easing: ease-in-out
   - Content fades/scales appropriately

2. Hidden State Reveal
   - Hover zone: 8px transparent strip
   - On hover: slide from -48px to 0
   - On leave: slide back after 300ms delay

3. Active Indicator
   - Left bar: 2px accent color
   - On activate: scale-x from 0 to 1
   - Subtle glow pulse

4. Badge Animation
   - On count change: scale bounce (1 → 1.2 → 1)
   - Duration: 150ms
```

## Related Code Files

### To Modify

| File | Change |
|------|--------|
| `src/renderer/styles/globals.css` | Add Activity Bar animations |
| `src/renderer/components/activity-bar/activity-bar.tsx` | Add transition classes |
| `src/renderer/components/activity-bar/activity-bar-item.tsx` | Add active animation |

## Implementation Steps

1. **Add CSS animations to globals.css**
   ```css
   /* Activity Bar transitions */
   .activity-bar {
     transition: width var(--mc-activity-bar-transition);
     will-change: width;
   }

   /* Hidden state hover reveal */
   .activity-bar-hidden {
     width: 0;
     overflow: hidden;
   }

   .activity-bar-hover-zone {
     position: fixed;
     left: 0;
     top: 0;
     bottom: 0;
     width: 8px;
     z-index: 50;
   }

   .activity-bar-reveal {
     animation: activity-bar-slide-in 200ms ease-out forwards;
   }

   @keyframes activity-bar-slide-in {
     from { transform: translateX(-100%); }
     to { transform: translateX(0); }
   }

   /* Active indicator animation */
   .activity-bar-item-active::before {
     content: '';
     position: absolute;
     left: 0;
     top: 4px;
     bottom: 4px;
     width: 2px;
     background: var(--mc-accent);
     animation: indicator-activate 200ms ease-out;
   }

   @keyframes indicator-activate {
     from { transform: scaleY(0); }
     to { transform: scaleY(1); }
   }

   /* Badge pulse */
   .activity-bar-badge-pulse {
     animation: badge-pulse 150ms ease-out;
   }

   @keyframes badge-pulse {
     0% { transform: scale(1); }
     50% { transform: scale(1.2); }
     100% { transform: scale(1); }
   }

   /* Reduced motion */
   @media (prefers-reduced-motion: reduce) {
     .activity-bar,
     .activity-bar-reveal,
     .activity-bar-item-active::before,
     .activity-bar-badge-pulse {
       animation: none;
       transition: none;
     }
   }
   ```

2. **Update activity-bar.tsx for hover reveal**
   ```typescript
   // Hidden state with hover zone
   const [isHovering, setIsHovering] = useState(false)
   const hideTimeoutRef = useRef<number>()

   if (activityBarState === 'hidden') {
     return (
       <>
         {/* Hover zone */}
         <div
           className="activity-bar-hover-zone"
           onMouseEnter={() => {
             clearTimeout(hideTimeoutRef.current)
             setIsHovering(true)
           }}
           onMouseLeave={() => {
             hideTimeoutRef.current = setTimeout(() => setIsHovering(false), 300)
           }}
         />
         {/* Revealed bar */}
         {isHovering && (
           <div className="activity-bar activity-bar-reveal" style={{ width: 48 }}>
             {/* ... content */}
           </div>
         )}
       </>
     )
   }
   ```

3. **Update activity-bar-item.tsx for active animation**
   - Add `activity-bar-item-active` class when active
   - Trigger animation on active change

4. **Add badge pulse on count change**
   ```typescript
   // In activity-bar-item.tsx
   const [shouldPulse, setShouldPulse] = useState(false)
   const prevBadge = useRef(badge)

   useEffect(() => {
     if (badge !== prevBadge.current && badge !== undefined) {
       setShouldPulse(true)
       setTimeout(() => setShouldPulse(false), 150)
     }
     prevBadge.current = badge
   }, [badge])
   ```

## Todo List

- [ ] Add Activity Bar CSS animations to globals.css
- [ ] Implement hover reveal for hidden state
- [ ] Add active indicator animation
- [ ] Add badge pulse animation
- [ ] Add prefers-reduced-motion support
- [ ] Test transitions feel smooth
- [ ] Test hover reveal timing
- [ ] Test no layout shift during transitions

## Success Criteria

- [ ] Width transitions are smooth 200ms
- [ ] Hidden state reveals on hover with slide-in
- [ ] Bar hides after 300ms when mouse leaves
- [ ] Active indicator animates on switch
- [ ] Badge pulses when count changes
- [ ] Animations disabled with prefers-reduced-motion
- [ ] No visual jank or layout shift

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hover zone interferes with content | Medium | Use pointer-events: none except on zone |
| Animation performance | Low | Use transform/opacity only |
| Reduced motion not respected | Low | Test with system setting |

## Security Considerations

None - CSS animations only.

## Next Steps

After completion:
- Phase 06: Final testing and sidebar cleanup
