# Brainstorm Report: Settings - Theme & Light/Dark Mode

**Date:** 2025-12-31
**Status:** Draft

---

## Problem Statement

MultiClaude cần thêm phần Settings với:
- Toggle Light/Dark/System mode
- Color theme selector (7 themes như Auto Claude)

## Requirements

1. UI consistent với Auto Claude's ThemeSelector design
2. Settings icon ở bottom sidebar
3. Modal/panel để chọn settings
4. Persist settings via localStorage
5. Live preview khi thay đổi theme

## Analyzed Approaches

### Approach 1: Inline Sidebar Panel ✅ RECOMMENDED

**Description:** Settings panel mở inline trong sidebar, slide down từ bottom

**Pros:**
- Không cần modal/overlay phức tạp
- Context-aware - user thấy rõ đang ở đâu
- Code đơn giản, dễ maintain
- Tương tự Auto Claude's approach

**Cons:**
- Giới hạn space cho nhiều settings

**Complexity:** Low

### Approach 2: Full Modal Dialog

**Description:** Modal overlay toàn screen

**Pros:**
- Nhiều space cho settings
- Extensible cho future settings

**Cons:**
- Over-engineered cho chỉ 2 settings
- Cần thêm modal management logic

**Complexity:** Medium

### Approach 3: Separate Settings Page

**Description:** Routing-based settings page

**Pros:**
- Full flexibility

**Cons:**
- Quá phức tạp cho use case này
- Cần router setup
- Bad UX - phải navigate away

**Complexity:** High

## Recommended Solution

**Approach 1: Inline Sidebar Panel** với cấu trúc sau:

### Files to Create/Modify

```
src/
├── shared/
│   ├── types/
│   │   └── index.ts                    # Add AppSettings, ColorTheme types
│   └── constants/
│       └── themes.ts                   # NEW: Color theme definitions
├── renderer/
│   ├── stores/
│   │   └── settings-store.ts           # NEW: Zustand settings store
│   ├── components/
│   │   └── settings/
│   │       ├── index.ts                # NEW: Export barrel
│   │       ├── settings-panel.tsx      # NEW: Settings container panel
│   │       └── theme-selector.tsx      # NEW: Theme/mode selector UI
│   ├── styles/
│   │   └── globals.css                 # Add CSS variables for themes
│   └── App.tsx                         # Apply theme from store
└── renderer/components/sidebar/
    └── sidebar.tsx                     # Add settings button + panel toggle
```

### Implementation Details

#### 1. Type Definitions (`shared/types/index.ts`)
```typescript
export type ThemeMode = 'light' | 'dark' | 'system'
export type ColorTheme = 'default' | 'dusk' | 'lime' | 'ocean' | 'retro' | 'neo' | 'forest'

export interface AppSettings {
  themeMode: ThemeMode
  colorTheme: ColorTheme
}
```

#### 2. Theme Constants (`shared/constants/themes.ts`)
- Copy từ Auto Claude với minor adaptations
- 7 themes với preview colors

#### 3. Settings Store (`renderer/stores/settings-store.ts`)
- Zustand store (đã có trong project)
- Load/save from localStorage
- Default: `{ themeMode: 'system', colorTheme: 'default' }`

#### 4. Theme Selector Component
- Grid layout cho theme cards
- 3-column mode toggle (Light/Dark/System)
- Preview swatches
- Checkmark cho selected items

#### 5. CSS Variables (`globals.css`)
- CSS custom properties cho mỗi theme
- `.theme-{name}` class cho color overrides
- `.light` / `.dark` class cho mode

#### 6. Sidebar Integration
- Settings gear icon ở bottom
- Toggle `showSettings` state
- Inline panel với theme-selector

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | localStorage | Simple, no deps, sufficient for settings |
| Theme application | CSS variables + classes | Standard, performant, maintainable |
| Store | Zustand | Already in project, consistent |
| Icons | SVG inline | No new dependencies |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| CSS conflicts with existing styles | Use scoped CSS variables with unique prefix |
| localStorage not available | Fallback to in-memory state |
| Performance on theme switch | CSS variables = instant, no re-render |

## Success Criteria

- [ ] Settings icon visible ở bottom sidebar
- [ ] Click mở settings panel
- [ ] 3 mode options hoạt động (Light/Dark/System)
- [ ] 7 color themes hiển thị với preview
- [ ] Settings persist qua refresh
- [ ] Live preview khi chọn theme

## Next Steps

1. Create implementation plan
2. Set up types và constants
3. Build settings store
4. Create UI components
5. Integrate into sidebar
6. Add CSS variables cho themes
7. Test all combinations

---

## Unresolved Questions

None - requirements đã được clarify qua Q&A.
