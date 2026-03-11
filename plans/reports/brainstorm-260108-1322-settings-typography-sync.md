# Brainstorm: Settings Typography Synchronization

## Problem Statement

Settings section has inconsistent typography and presentation across 6+ components:
- Section headers: `font-semibold` vs `font-medium`, some tabs missing headers
- Sub-section labels: 4 different approaches (`h4`/`div`/`span`, `text-xs`/`text-sm`, uppercase/sentence)
- Dividers: inconsistent margin classes, some tabs have none
- Semantic HTML: mixed element usage breaks accessibility

## Requirements

1. Uniform font weight for all section headers
2. Consistent sub-section label styling
3. Standardized divider appearance
4. Semantic HTML structure for accessibility
5. Single source of truth (DRY)

## Evaluated Approaches

### ✅ Approach 1: Shared Components (SELECTED)

Create reusable typography components in `settings-typography.tsx`:

```tsx
// SettingsTitle - main section header
<h3 className="text-lg font-medium text-[var(--mc-text-primary)] mb-4">

// SettingsSubheading - sub-section label
<h4 className="text-xs font-medium uppercase text-[var(--mc-text-muted)] mb-2 tracking-wide">

// SettingsDivider - horizontal separator
<hr className="my-4 border-[var(--mc-border)]">
```

**Pros:**
- DRY - single source of truth
- Easy global updates
- Enforces semantic HTML
- Type-safe with TypeScript

**Cons:**
- Requires refactoring 6 files
- Adds abstraction layer

### ❌ Approach 2: CSS Class Tokens

Define `.settings-title`, `.settings-subheading` in globals.css.

**Rejected:** Doesn't enforce semantic HTML, easy to bypass.

### ❌ Approach 3: Hybrid

Mix of components and classes.

**Rejected:** Unnecessary complexity for this scope.

## Final Solution

### Components to Create

**File:** `src/renderer/components/settings/settings-typography.tsx`

| Component | Element | Classes | Purpose |
|-----------|---------|---------|---------|
| `SettingsTitle` | `<h3>` | `text-lg font-medium text-[var(--mc-text-primary)] mb-4` | Tab main header |
| `SettingsSubheading` | `<h4>` | `text-xs font-medium uppercase text-[var(--mc-text-muted)] mb-2 tracking-wide` | Section labels |
| `SettingsDivider` | `<hr>` | `my-4 border-[var(--mc-border)]` | Section separator |

### Files to Update

| File | Changes |
|------|---------|
| `theme-selector.tsx` | Replace h3/h4 with shared components |
| `terminal-settings.tsx` | Replace inline SettingsSection, use shared components |
| `notification-settings.tsx` | Add SettingsTitle, standardize sub-section labels |
| `update-settings.tsx` | Change font-semibold → font-medium, use shared components |
| `telegram-config-modal.tsx` | Use consistent header component |
| `discord-config-modal.tsx` | Use consistent header component |

### Visual Hierarchy

```
┌─────────────────────────────────────┐
│ Settings                            │  ← Modal title (text-lg font-semibold)
├─────────────────────────────────────┤
│ Appearance                          │  ← SettingsTitle (text-lg font-medium)
│                                     │
│ MODE                                │  ← SettingsSubheading (text-xs uppercase)
│ ○ Light  ○ Dark  ○ System          │
│ ─────────────────────────────────── │  ← SettingsDivider
│ COLOR THEME                         │  ← SettingsSubheading
│ [theme options]                     │
└─────────────────────────────────────┘
```

## Implementation Considerations

1. **Backward compatibility:** Export both new and legacy components during transition
2. **Config modals:** May need separate `ModalTitle` if hierarchy differs
3. **Testing:** Verify all tabs render correctly after refactor
4. **Documentation:** Update component storybook if exists

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing UI | Run e2e tests after each file change |
| Missing a file | Use Grep to find all `text-lg.*font-` patterns |
| Styling conflicts | Keep specificity low, use CSS variables |

## Success Metrics

- [ ] All 6 settings tabs use shared typography components
- [ ] Visual diff shows consistent presentation
- [ ] No accessibility regression (semantic HTML preserved)
- [ ] Single file controls all settings typography

## Next Steps

1. Create `settings-typography.tsx` with 3 components
2. Update each settings file sequentially
3. Run visual regression test
4. Remove dead code from old inline styles

---

**Decision:** Proceed with Shared Components approach
**Font weight:** font-medium (500)
**Labels:** UPPERCASE + text-xs + tracking-wide
