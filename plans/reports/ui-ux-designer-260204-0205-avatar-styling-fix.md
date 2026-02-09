# UI/UX Design Update: Avatar Styling Fix

**Date:** 2026-02-04
**Agent:** ui-ux-designer
**Status:** Completed

## Summary
Addressed a visual regression where user avatars appeared as rounded rectangles instead of circles when the application was in "Terminal Mode".

## Analysis
- **Issue**: The application features a "Terminal Mode" (`.ui-terminal` class on body) that overrides standard styles to enforce a retro, blocky aesthetic. This included a global reset of `border-radius: 0 !important` on most elements.
- **Affected Component**: `ActivityBarAccountSection` and other components using `rounded-full` for avatars and status indicators.
- **Root Cause**: The global CSS rule for `.ui-terminal` specificity was overriding the Tailwind utility class `rounded-full`.

## Implementation
1. **Global Style Override**: Updated `src/renderer/styles/globals.css` to explicitly preserve `border-radius: 9999px` for `.rounded-full` elements within `.ui-terminal`.
   ```css
   .ui-terminal .rounded-full {
     border-radius: 9999px !important;
   }
   ```
2. **Design Guidelines**: Created `docs/design-guidelines.md` to document the exception for circular elements in Terminal Mode.

## Verification
- Checked `ActivityBarAccountSection` code: it uses `rounded-full` correctly.
- Reviewed global CSS: the new rule has sufficient specificity to override the reset.
- No other changes were needed in component files as the fix is systemic.

## Next Steps
- Ensure any future circular UI elements use `rounded-full` utility class to inherit this protection.
