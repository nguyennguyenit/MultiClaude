# Brainstorm Report: Glassmorphism Full App Redesign

**Date:** 2026-01-07
**Status:** Approved for Implementation

---

## Problem Statement

User wants comprehensive visual redesign of MultiClaude app beyond just color themes - full styling overhaul including navigation, content areas, modals, and form controls.

## Requirements

1. **Scope:** All UI components (navigation chrome, content area, settings modal, form controls)
2. **Style:** Glassmorphism + Modern Soft hybrid approach
3. **Approach:** Phased implementation, starting with core components
4. **Existing:** `glassmorphismEnabled: boolean` already added to AppSettings

## Evaluated Approaches

### Option A: 4 Distinct Design Styles
- Modern Soft, Brutalist, Glassmorphism, Neumorphism
- **Rejected:** Too complex, maintenance overhead, Neumorphism has accessibility issues

### Option B: Single Glassmorphism Style
- Only glassmorphism throughout
- **Rejected:** Need fallback for devices without backdrop-filter support

### Option C: Hybrid Approach (SELECTED)
- **Base:** Modern Soft (rounded corners, subtle shadows)
- **Enhancement:** Glassmorphism for overlays, sidebars
- **Fallback:** Graceful degradation without blur effects

## Final Recommended Solution

### Design System

| Element | Base Style | Glassmorphism Enhancement |
|---------|------------|---------------------------|
| Sidebar | Solid bg with rounded corners | Semi-transparent + backdrop blur |
| Terminal panels | Solid dark backgrounds | None (performance) |
| Modals/Settings | Rounded corners, shadows | Backdrop blur overlay |
| Buttons/Controls | Rounded, subtle shadows | Optional hover glow |
| Borders | Solid thin lines | Transparent glow borders |

### Design Tokens to Implement

```css
/* Glassmorphism tokens */
--mc-blur-amount: 12px;
--mc-glass-bg-dark: rgba(255, 255, 255, 0.05);
--mc-glass-bg-light: rgba(0, 0, 0, 0.03);
--mc-glass-border: 1px solid rgba(255, 255, 255, 0.1);
--mc-glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
--mc-radius-sm: 6px;
--mc-radius-md: 12px;
--mc-radius-lg: 16px;
--mc-radius-xl: 24px;
```

### Reference: Warp Terminal
- Semi-transparent sidebar (10-25% opacity) + Gaussian blur
- Subtle 1px "inner-glow" borders
- Soft, diffused drop shadows
- High-contrast typography

## Implementation Phases

### Phase 1: Core Infrastructure
- Add glassmorphism CSS variables to globals.css
- Create `.glass` utility classes
- Update settings store for `glassmorphismEnabled` toggle
- Add toggle UI in Appearance settings

### Phase 2: Navigation Chrome
- Apply glassmorphism to sidebar (when enabled)
- Update title bar styling
- Smooth transitions between enabled/disabled states

### Phase 3: Content Area
- Terminal panel styling updates
- Tab styling with rounded corners
- Resize handles with subtle glow

### Phase 4: Overlays & Modals
- Settings modal with backdrop blur
- Dialogs and toasts styling
- Dropdown menus

### Phase 5: Form Controls
- Buttons with modern rounded style
- Input fields with subtle borders
- Toggle switches and checkboxes
- Hover/focus state enhancements

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Performance (backdrop-filter) | Only apply to overlays, not content areas |
| Browser support | Graceful fallback via CSS @supports |
| Accessibility | Maintain WCAG AA contrast ratios |
| Complexity | Phased approach, test each phase |

## Success Metrics

1. Visual consistency across all UI components
2. Smooth toggle between glassmorphism enabled/disabled
3. No performance regression
4. All existing themes work with new styling
5. WCAG AA compliance maintained

## Files to Modify (Estimated)

- `src/renderer/styles/globals.css` - Core CSS variables and utility classes
- `src/renderer/components/layout/Sidebar.tsx` - Glassmorphism styling
- `src/renderer/components/layout/TitleBar.tsx` - Updated styling
- `src/renderer/components/settings/*.tsx` - Modal and form styling
- `src/renderer/components/terminal/*.tsx` - Panel styling
- `src/renderer/components/ui/*.tsx` - Button, input components

## Next Steps

Invoke `/plan:hard` to create detailed implementation plan with file-level tasks.

---

**Unresolved Questions:** None
