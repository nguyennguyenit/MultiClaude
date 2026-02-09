# Brainstorm: Sidebar UX/UI Reorganization

**Date:** 2026-01-04
**Status:** Agreed
**Target File:** `src/renderer/components/sidebar/sidebar.tsx`

---

## Problem Statement

Cấu trúc sidebar hiện tại không có sự phân chia logic rõ ràng:
- Terminal tools bị lẫn trong "Tools" section chung
- Git và GitHub là hai section riêng nhưng chức năng liên quan
- Người dùng khó tìm nhanh công cụ cần thiết

**Yêu cầu:** Tổ chức lại sidebar thành 2 nhóm chính: **Terminals** và **GitHub**

---

## Cấu trúc Hiện tại

```
[Features] ← Label header
├── [Git Section]
│   ├── Branch info
│   ├── Changes count
│   └── Initialize Git button
├── [GitHub Section]
│   ├── Auth status/Login
│   ├── Connect to GitHub
│   └── Remote URL
├── [Tools Section]
│   ├── New Terminal ← Terminal-related
│   ├── YOLO Mode toggle ← Terminal-related
│   └── Kill All ← Terminal-related
└── [Settings] ← Bottom, fixed
```

---

## Cấu trúc Đề xuất

```
┌─────────────────────────────┐
│ [Terminals]                 │  ← New section header
├─────────────────────────────┤
│ 🟢 New Terminal             │
│ ⚡ YOLO Mode        [toggle] │
│ ❌ Kill All (n)             │
├─────────────────────────────┤
│ [Settings]                  │  ← Moved to middle
├─────────────────────────────┤
│   [Expandable Panel]        │
│   └── Appearance            │
│   └── Notifications         │
├─────────────────────────────┤
│ [GitHub]                    │  ← Consolidated section
├─────────────────────────────┤
│ 🔗 @username / Login        │  ← Auth first
│ ─────────────────           │
│ Branch: main                │  ← Git status second
│ 3 changes                   │
│ ─────────────────           │
│ [Connect to GitHub]         │  ← Repo actions last
│ [Initialize Git]            │
└─────────────────────────────┘
```

---

## Quyết định Đã Thống nhất

| Item | Quyết định |
|------|------------|
| Section name cho terminal tools | **Terminals** |
| Thứ tự trong GitHub section | **Auth → Git status → Repo actions** |
| Icon cho GitHub section | **Combined GitHub icon** (không phân biệt Git/GitHub) |

---

## Approach: Restructure sidebar.tsx

### Step 1: Reorder JSX sections

**Move order:**
1. Terminals section (was Tools) → Top
2. Settings section → Middle
3. GitHub section (merge Git + GitHub) → Bottom

### Step 2: Consolidate Git + GitHub

Merge 2 sections thành 1 với flow:
1. Auth status / Login button
2. Git repository info (branch, changes)
3. Repository actions (Connect, Create)

### Step 3: Update styling

- Remove border giữa các section cũ
- Thêm visual grouping mới
- Giữ nguyên color scheme

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| State management phức tạp hơn khi merge | Low | Giữ nguyên state hooks, chỉ đổi render order |
| Settings panel expand có thể đẩy GitHub section | Medium | Fixed height cho Settings collapsed state |
| UX familiarity - user quen layout cũ | Low | Layout mới intuitive hơn, nhanh adapt |

---

## Success Metrics

- [ ] Terminal tools dễ tìm ngay khi mở sidebar
- [ ] GitHub operations grouped logically
- [ ] No broken functionality
- [ ] Settings accessible but không chiếm space khi collapsed

---

## Implementation Considerations

**Không thay đổi:**
- Logic handlers (handleAddTerminal, handleGitHubLogin, etc.)
- State hooks và data flow
- CSS variables / theme

**Thay đổi:**
- JSX order trong return statement
- Section headers và labels
- Icon grouping cho GitHub section

**Files affected:**
- `src/renderer/components/sidebar/sidebar.tsx` - main restructure

---

## Visual Mockup (ASCII)

```
┌────────────────────────────────┐
│  TERMINALS                     │
│ ──────────────────────────────│
│  [+] New Terminal              │
│  [⚡] YOLO Mode         [○━━]  │
│  [×] Kill All (2)              │
│                                │
│  SETTINGS                ▼     │
│ ──────────────────────────────│
│  ┌───────────────────────────┐│
│  │ Appearance | Notifications││
│  │ [Theme selector...]       ││
│  └───────────────────────────┘│
│                                │
│  GITHUB                        │
│ ──────────────────────────────│
│  ● @username          [logout]│
│  Branch: main                  │
│  ⚠ 3 uncommitted changes      │
│  [Connect to GitHub]           │
└────────────────────────────────┘
```

---

## Next Steps

1. **If approved:** Create detailed implementation plan via `/plan`
2. **Testing:** Manual testing của all sidebar interactions
3. **Review:** Visual review trên different themes

---

## Unresolved Questions

*None - all requirements clarified.*
