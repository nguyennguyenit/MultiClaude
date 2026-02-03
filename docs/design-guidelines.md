# Design Guidelines

## Terminal Mode Styling

The application supports a "Terminal Mode" which applies a retro terminal aesthetic. This mode overrides many standard styles, particularly border-radius.

### Border Radius Handling

In Terminal Mode (`.ui-terminal` class on body), most elements have their `border-radius` reset to `0` to maintain a blocky, terminal-like appearance.

**Exceptions:**
- Circular elements (avatars, status indicators, badges) should retain their circular shape.
- Use the utility class `.rounded-full` for these elements.
- The global CSS ensures `.rounded-full` is preserved even in terminal mode:

```css
/* Preserve rounded-full in terminal mode */
.ui-terminal .rounded-full {
  border-radius: 9999px !important;
}
```

### Avatars
- User avatars should always be circular (`rounded-full`).
- Size should be appropriate for context (e.g., `w-7 h-7` or `w-8 h-8` in sidebar).
- Fallback for missing avatar image is a circular container with initials.

### Status Indicators
- Status dots (online/offline/syncing) should be circular.
- Use `rounded-full` for these indicators.
