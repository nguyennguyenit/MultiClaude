# MultiClaude UI/UX Design Documentation

## Mục lục

1. [Tổng quan Layout](#tổng-quan-layout)
2. [Sidebar Structure](#sidebar-structure)
3. [Main Content - Terminals View](#main-content---terminals-view)
4. [Main Content - GitHub View](#main-content---github-view)
5. [Settings Popup](#settings-popup)
6. [Component Details](#component-details)
7. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Tổng quan Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🤖 MultiClaude                                            ─   □   ✕       │
├────────────────────┬────────────────────────────────────────────────────────┤
│                    │  [ 1 SEOKit.cc ] [ 2 Soft2 ] [ 3 MultiClaude ]    +   │
│     SIDEBAR        ├────────────────────────────────────────────────────────┤
│   (Collapsible)    │                                                        │
│                    │                    MAIN CONTENT                        │
│                    │                                                        │
└────────────────────┴────────────────────────────────────────────────────────┘
```

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        TITLE BAR (32px)                          │
│  🤖 MultiClaude                                    ─   □   ✕    │
├──────────────────┬──────────────────────────────────────────────┤
│                  │           PROJECT TABS (36px)                 │
│                  │  [ Project 1 ] [ Project 2 ] ...         +   │
│     SIDEBAR      ├──────────────────────────────────────────────┤
│    (240px /      │           ACTION BAR (40px)                   │
│     60px)        │  Status (left)    │    Action Buttons (right) │
│                  ├──────────────────────────────────────────────┤
│  - Navigation    │                                               │
│  - User Account  │           MAIN CONTENT (flex)                 │
│  - Settings      │                                               │
│                  │                                               │
└──────────────────┴──────────────────────────────────────────────┘
```

---

## Sidebar Structure

### Expanded vs Collapsed

```
Expanded (240px):                      Collapsed (60px):
┌────────────────────────┐             ┌──────────┐
│   🤖 MultiClaude    ◀  │             │    🤖  ▶ │
├────────────────────────┤             ├──────────┤
│                        │             │          │
│   NAVIGATION           │             │          │
│   ──────────────────   │             │          │
│                        │             │          │
│  ▶ 📟 Terminals        │             │   ▶📟    │  ← Active view
│                        │             │          │
│    🔀 GitHub           │  ◄────►     │    🔀    │
│                        │             │          │
├────────────────────────┤             ├──────────┤
│                        │             │          │
│        (Spacer)        │             │          │
│                        │             │          │
├────────────────────────┤             ├──────────┤
│                        │             │          │
│  ┌──────────────────┐  │             │          │
│  │ 👤 nguyennguyenit│  │             │    👤    │
│  │ ● Connected      │  │             │    ●     │
│  │ 🌿 main          │  │             │          │
│  └──────────────────┘  │             │          │
│                        │             │          │
│  ⚙️ Settings           │             │    ⚙️    │
└────────────────────────┘             └──────────┘
```

### Sidebar Chi tiết - Expanded

```
┌────────────────────────────┐
│                            │
│   🤖 MultiClaude       ◀   │  ← Collapse button
│                            │
├────────────────────────────┤
│                            │
│   NAVIGATION               │  ← Section header (muted)
│                            │
│  ┃▶ 📟 Terminals           │  ← Active view (accent border)
│                            │
│     🔀 GitHub              │  ← Inactive view
│                            │
├────────────────────────────┤
│                            │
│        (Spacer)            │
│                            │
├────────────────────────────┤
│                            │
│  ┌──────────────────────┐  │
│  │  👤 nguyennguyenit   │  │  ← GitHub account
│  │  ● Connected         │  │     (green = connected)
│  │  🌿 main             │  │     (current branch)
│  └──────────────────────┘  │
│                            │
├────────────────────────────┤
│                            │
│  ⚙️ Settings               │  ← Opens Settings popup
│                            │
└────────────────────────────┘
```

### Sidebar Components

| Section         | Expanded              | Collapsed    |
|-----------------|----------------------|--------------|
| App Logo        | 🤖 MultiClaude ◀     | 🤖 ▶         |
| Terminals       | ▶ 📟 Terminals       | ▶📟          |
| GitHub          | 🔀 GitHub            | 🔀           |
| User Account    | Card với full info   | 👤 + ● icon  |
| Settings        | ⚙️ Settings          | ⚙️           |

### Navigation Item States

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  NORMAL:      │  🔀 GitHub          │   text-muted             │
│               └─────────────────────┘                          │
│                                                                 │
│  HOVER:       │  🔀 GitHub          │   background: hover-bg   │
│               └─────────────────────┘                          │
│                                                                 │
│  ACTIVE:      │ ┃▶ 📟 Terminals     │   left-border: accent    │
│               └─────────────────────┘   text: accent, bold     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### GitHub Account Card

#### Expanded State

```
┌──────────────────────────┐
│                          │
│  👤 nguyennguyenit       │  ← Username
│  ● Connected             │  ← Status với green dot
│  🌿 main                 │  ← Current branch
│                          │
└──────────────────────────┘
```

#### Collapsed State (Hover Tooltip)

```
┌──────────┐      ┌─────────────────────┐
│          │      │ nguyennguyenit      │
│    👤    │ ───► │ Connected           │
│    ●     │      │ Branch: main        │
│          │      └─────────────────────┘
└──────────┘            (tooltip)
```

#### Connection States

| State        | Icon | Color  | Description          |
|--------------|------|--------|----------------------|
| Connected    | ●    | Green  | Logged in, ready     |
| Disconnected | ○    | Gray   | Not logged in        |
| Syncing      | ◐    | Amber  | Operation in progress|
| Error        | ●    | Red    | Connection failed    |

---

## Main Content - Terminals View

### Full Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🤖 MultiClaude                                            ─   □   ✕       │
├────────────────────┬────────────────────────────────────────────────────────┤
│                    │  [ 1 SEOKit.cc ] [ 2 Soft2 ] [ 3 MultiClaude ]    +   │
│   🤖 MultiClaude ◀ ├────────────────────────────────────────────────────────┤
│                    │                                                        │
├────────────────────┤  ┌──────────────────────────────────────────────────┐  │
│                    │  │ 📟 1 / 12 terminals     │ + New  ⚡YOLO  ✕ Kill  │  │
│   NAVIGATION       │  └──────────────────────────────────────────────────┘  │
│   ────────────────  │                                                        │
│                    │  ┌──────────────────────────────────────────────────┐  │
│  ▶ 📟 Terminals    │  │ Terminal 1                               📋 📌 ✕ │  │
│                    │  ├──────────────────────────────────────────────────┤  │
│    🔀 GitHub       │  │                                                  │  │
│                    │  │ plateau@plateau:~/MultiClaude$ ccs agy           │  │
├────────────────────┤  │ [OK] WebSearch: Ready (Gemini)                   │  │
│                    │  │ [i] CLIProxy Plus update available               │  │
│                    │  │ [OK] CLIProxy binary ready (0.0s)                │  │
│                    │  │                                                  │  │
│    (Spacer)        │  │ ╭─ Claude Code v2.0.76 ──────────────────────╮   │  │
│                    │  │ │     Welcome back!    │ Tips for getting    │   │  │
│                    │  │ │        *  🤖  *     │ started             │   │  │
│                    │  │ ╰────────────────────────────────────────────╯   │  │
├────────────────────┤  │                                                  │  │
│                    │  │ > _                                              │  │
│ ┌────────────────┐ │  │                                                  │  │
│ │👤 nguyennguyenit│ │  └──────────────────────────────────────────────────┘  │
│ │● Connected     │ │                                                        │
│ │🌿 main         │ │                                                        │
│ └────────────────┘ │                                                        │
│                    │                                                        │
│ ⚙️ Settings        │                                                        │
└────────────────────┴────────────────────────────────────────────────────────┘
```

### Terminal Action Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TERMINAL ACTION BAR                                 │
├─────────────────────────────────┬───────────────────────────────────────────┤
│  📟 1 / 12 terminals            │   + New Terminal   ⚡ YOLO ○   ✕ Kill All │
│                                 │                                            │
│  ← Left side: Status info       │   Right side: Action buttons →            │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

#### Left Side - Terminal Count

```
📟 1 / 12 terminals
│  │   │
│  │   └── Max terminals (configurable, default 12)
│  └────── Current active terminals  
└───────── Terminal icon
```

#### Right Side - Action Buttons

```
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  + New Terminal │  │  ⚡ YOLO Mode ○  │  │   ✕ Kill All    │
│                 │  │     (toggle)     │  │                 │
│  Primary button │  │   Warning color  │  │  Danger button  │
│  accent color   │  │   when active    │  │  red color      │
└─────────────────┘  └──────────────────┘  └─────────────────┘
```

### Collapsed Sidebar - Terminals View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🤖 MultiClaude                                            ─   □   ✕       │
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │  [ 1 SEOKit.cc ] [ 2 Soft2 ] [ 3 MultiClaude ]              +   │
│   🤖 ▶   ├──────────────────────────────────────────────────────────────────┤
│          │                                                                  │
├──────────┤  ┌────────────────────────────────────────────────────────────┐  │
│          │  │ 📟 1 / 12 terminals       │ + New   ⚡YOLO   ✕ Kill All   │  │
│  ▶📟     │  └────────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│   🔀     │  ┌────────────────────────────────────────────────────────────┐  │
│          │  │ Terminal 1                                         📋 📌 ✕ │  │
├──────────┤  ├────────────────────────────────────────────────────────────┤  │
│          │  │                                                            │  │
│          │  │ plateau@plateau:~/MultiClaude$ ccs agy                     │  │
│          │  │ [OK] WebSearch: Ready (Gemini)                             │  │
│          │  │                                                            │  │
│          │  │ ╭─ Claude Code v2.0.76 ────────────────────────────────╮   │  │
│          │  │ │       Welcome back!      │ Tips for getting started  │   │  │
├──────────┤  │ ╰──────────────────────────────────────────────────────╯   │  │
│          │  │                                                            │  │
│   👤     │  │ > _                                                        │  │
│   ●      │  │                                                            │  │
│          │  └────────────────────────────────────────────────────────────┘  │
│   ⚙️     │                                                                  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

---

## Main Content - GitHub View

### Full Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🤖 MultiClaude                                            ─   □   ✕       │
├────────────────────┬────────────────────────────────────────────────────────┤
│                    │  [ 1 SEOKit.cc ] [ 2 Soft2 ] [ 3 MultiClaude ]    +   │
│   🤖 MultiClaude ◀ ├────────────────────────────────────────────────────────┤
│                    │                                                        │
├────────────────────┤  ┌──────────────────────────────────────────────────┐  │
│                    │  │ 🔀 nguyennguyenit/MultiClaude │ ⬆️ ⬇️ 🔄 📥     │  │
│   NAVIGATION       │  └──────────────────────────────────────────────────┘  │
│   ────────────────  │                                                        │
│                    │  ┌──────────────────────────────────────────────────┐  │
│    📟 Terminals    │  │ 📂 Repository: nguyennguyenit/MultiClaude        │  │
│                    │  │ 🌿 Branch: main           📝 3 changes           │  │
│  ▶ 🔀 GitHub       │  └──────────────────────────────────────────────────┘  │
│                    │                                                        │
├────────────────────┤  ┌──────────────────────────────────────────────────┐  │
│                    │  │ [ Branches ] [ Commits ] [ Stash ] [ Issues ]    │  │
│                    │  ├──────────────────────────────────────────────────┤  │
│                    │  │                                                  │  │
│    (Spacer)        │  │  🌿 main (current)                               │  │
│                    │  │  🌿 develop                                      │  │
│                    │  │  🌿 feature/drag-drop                            │  │
│                    │  │  🌿 release/v1.0.1                               │  │
├────────────────────┤  │                                                  │  │
│                    │  │  + Create new branch                             │  │
│ ┌────────────────┐ │  │                                                  │  │
│ │👤 nguyennguyenit│ │  └──────────────────────────────────────────────────┘  │
│ │● Connected     │ │                                                        │
│ │🌿 main         │ │                                                        │
│ └────────────────┘ │                                                        │
│                    │                                                        │
│ ⚙️ Settings        │                                                        │
└────────────────────┴────────────────────────────────────────────────────────┘
```

### GitHub Action Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GITHUB ACTION BAR                                   │
├─────────────────────────────────┬───────────────────────────────────────────┤
│  🔀 nguyennguyenit/MultiClaude  │   ⬆️ Push   ⬇️ Pull   🔄 Sync   📥 Fetch  │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

### GitHub Tabs

```
[ Branches ]  [ Commits ]  [ Stash ]  [ Issues ]  [ PRs ]
```

---

## Settings Popup

### Layout Structure (3 Tabs)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                          ✕     │
│  App Settings                                                               │
├────────────────────────┬────────────────────────────────────────────────────┤
│                        │                                                     │
│  🎨 Appearance     ◀   │                                                     │
│                        │            (Content Area)                          │
│  📟 Terminals          │                                                     │
│                        │                                                     │
│  🔔 Notifications      │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
│                        │                                                     │
├────────────────────────┴────────────────────────────────────────────────────┤
│                                            [ Cancel ]  [ 💾 Save Settings ]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tab 1: Appearance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                          ✕     │
│  App Settings                                                               │
├────────────────────────┬────────────────────────────────────────────────────┤
│                        │                                                     │
│  🎨 Appearance     ◀   │   Appearance                                        │
│                        │   Customize how MultiClaude looks                  │
│  📟 Terminals          │   ─────────────────────────────────────────────    │
│                        │                                                     │
│  🔔 Notifications      │   Appearance Mode                                   │
│                        │   Choose light, dark, or system preference         │
│                        │                                                     │
│                        │   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│                        │   │   🖥️    │ │   ☀️    │ │   🌙  ✓ │           │
│                        │   │  System  │ │  Light   │ │   Dark   │           │
│                        │   └──────────┘ └──────────┘ └──────────┘           │
│                        │                                                     │
│                        │   Color Theme                                       │
│                        │   Select a color palette for the interface         │
│                        │                                                     │
│                        │   ┌────────┐ ┌────────┐ ┌────────┐                 │
│                        │   │●● Def  │ │●● Dusk │ │●● Lime │                 │
│                        │   └────────┘ └────────┘ └────────┘                 │
│                        │   ┌────────┐ ┌────────┐ ┌────────┐                 │
│                        │   │●● Ocean│ │●● Retro│ │●● Neo  │                 │
│                        │   └────────┘ └──────✓─┘ └────────┘                 │
│                        │   ┌────────┐                                        │
│                        │   │●●Forest│                                        │
│                        │   └────────┘                                        │
│                        │                                                     │
├────────────────────────┴────────────────────────────────────────────────────┤
│                                            [ Cancel ]  [ 💾 Save Settings ]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Appearance Options

| Option          | Type    | Values                                              | Default |
|-----------------|---------|-----------------------------------------------------|---------|
| Appearance Mode | Select  | System, Light, Dark                                 | Dark    |
| Color Theme     | Select  | Default, Dusk, Lime, Ocean, Retro, Neo, Forest     | Retro   |

#### Color Theme Swatches

| Theme   | Primary | Accent  | Description                          |
|---------|---------|---------|--------------------------------------|
| Default | #1a1a1a | #f5d742 | Oscura-inspired with pale yellow     |
| Dusk    | #2a2520 | #d4a574 | Warmer variant, slightly lighter     |
| Lime    | #1a1f1a | #84cc16 | Fresh, energetic lime with purple    |
| Ocean   | #1a1f2e | #3b82f6 | Calm, professional blue tones        |
| Retro   | #2a2010 | #f59e0b | Warm, nostalgic amber vibes          |
| Neo     | #1f1a2e | #d946ef | Modern cyberpunk pink/magenta        |
| Forest  | #1a2418 | #22c55e | Natural, earthy green tones          |

### Tab 2: Terminals

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                          ✕     │
│  App Settings                                                               │
├────────────────────────┬────────────────────────────────────────────────────┤
│                        │                                                     │
│  🎨 Appearance         │   Terminals                                         │
│                        │   Configure terminal behavior and display          │
│  📟 Terminals      ◀   │   ─────────────────────────────────────────────    │
│                        │                                                     │
│  🔔 Notifications      │   General                                           │
│                        │                                                     │
│                        │   Max Terminals              ┌─────────────────┐   │
│                        │                              │       12      ▼ │   │
│                        │                              └─────────────────┘   │
│                        │                                                     │
│                        │   Default Shell              ┌─────────────────┐   │
│                        │                              │      bash     ▼ │   │
│                        │                              └─────────────────┘   │
│                        │                                                     │
│                        │   Working Directory          ┌─────────────────┐   │
│                        │                              │  ~/Projects   ▼ │   │
│                        │                              └─────────────────┘   │
│                        │                                                     │
│                        │   ─────────────────────────────────────────────    │
│                        │                                                     │
│                        │   Behavior                                          │
│                        │                                                     │
│                        │   Auto-scroll Output                        ●━━━   │
│                        │                                                     │
│                        │   Confirm Before Kill All                   ●━━━   │
│                        │                                                     │
│                        │   Remember Terminal Layout                  ●━━━   │
│                        │                                                     │
├────────────────────────┴────────────────────────────────────────────────────┤
│                                            [ Cancel ]  [ 💾 Save Settings ]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Terminals - Scrolled (More Options)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                          ✕     │
│  App Settings                                                               │
├────────────────────────┬────────────────────────────────────────────────────┤
│                        │                                                     │
│  🎨 Appearance         │   ─────────────────────────────────────────────    │
│                        │                                                     │
│  📟 Terminals      ◀   │   YOLO Mode                                         │
│                        │                                                     │
│  🔔 Notifications      │   Enable YOLO Mode                          ○───   │
│                        │                                                     │
│                        │   Auto-approve Commands                     ○───   │
│                        │                                                     │
│                        │   Skip Confirmation Prompts                 ○───   │
│                        │                                                     │
│                        │   ─────────────────────────────────────────────    │
│                        │                                                     │
│                        │   Display                                           │
│                        │                                                     │
│                        │   Font Size                  ┌─────────────────┐   │
│                        │                              │       14      ▼ │   │
│                        │                              └─────────────────┘   │
│                        │                                                     │
│                        │   Font Family                ┌─────────────────┐   │
│                        │                              │ JetBrains Mono▼ │   │
│                        │                              └─────────────────┘   │
│                        │                                                     │
│                        │   Cursor Style               ┌─────────────────┐   │
│                        │                              │     Block     ▼ │   │
│                        │                              └─────────────────┘   │
│                        │                                                     │
│                        │   Cursor Blink                              ●━━━   │
│                        │                                                     │
├────────────────────────┴────────────────────────────────────────────────────┤
│                                            [ Cancel ]  [ 💾 Save Settings ]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Terminals Options

**General Section**

| Option            | Type     | Values                              | Default      |
|-------------------|----------|-------------------------------------|--------------|
| Max Terminals     | Dropdown | 1, 2, 4, 6, 8, 10, 12              | 12           |
| Default Shell     | Dropdown | bash, zsh, fish, sh, powershell    | bash         |
| Working Directory | Dropdown | ~/, ~/Projects, ~/Desktop, Custom  | ~/Projects   |

**Behavior Section**

| Option                   | Type   | Description                              | Default |
|--------------------------|--------|------------------------------------------|---------|
| Auto-scroll Output       | Toggle | Tự động scroll xuống khi có output mới   | ON      |
| Confirm Before Kill All  | Toggle | Hiện confirm dialog trước khi kill all   | ON      |
| Remember Terminal Layout | Toggle | Lưu layout terminals khi đóng app        | ON      |

**YOLO Mode Section**

| Option                     | Type   | Description                            | Default |
|----------------------------|--------|----------------------------------------|---------|
| Enable YOLO Mode           | Toggle | Bật/tắt YOLO mode globally             | OFF     |
| Auto-approve Commands      | Toggle | Tự động approve các commands           | OFF     |
| Skip Confirmation Prompts  | Toggle | Bỏ qua các confirmation prompts        | OFF     |

**Display Section**

| Option       | Type     | Values                                       | Default        |
|--------------|----------|----------------------------------------------|----------------|
| Font Size    | Dropdown | 10, 11, 12, 13, 14, 15, 16, 18, 20          | 14             |
| Font Family  | Dropdown | JetBrains Mono, Fira Code, Monaco, Consolas | JetBrains Mono |
| Cursor Style | Dropdown | Block, Underline, Bar                        | Block          |
| Cursor Blink | Toggle   | Bật/tắt cursor nhấp nháy                     | ON             |

### Tab 3: Notifications

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                          ✕     │
│  App Settings                                                               │
├────────────────────────┬────────────────────────────────────────────────────┤
│                        │                                                     │
│  🎨 Appearance         │   Notifications                                     │
│                        │   Configure alerts and notification preferences    │
│  📟 Terminals          │   ─────────────────────────────────────────────    │
│                        │                                                     │
│  🔔 Notifications  ◀   │   Events                                            │
│                        │                                                     │
│                        │   On Task Complete                          ●━━━   │
│                        │                                                     │
│                        │   On Task Failed                            ●━━━   │
│                        │                                                     │
│                        │   On Review Needed                          ●━━━   │
│                        │                                                     │
│                        │   ─────────────────────────────────────────────    │
│                        │                                                     │
│                        │   Sound                                             │
│                        │                                                     │
│                        │   Enable Sound                              ●━━━   │
│                        │                                                     │
│                        │   Preset                     ┌─────────────────┐   │
│                        │                              │    Default    ▼ │   │
│                        │                              └─────────────────┘   │
│                        │                                                     │
│                        │   ─────────────────────────────────────────────    │
│                        │                                                     │
│                        │   External                                          │
│                        │                                                     │
│                        │   🔔 Telegram       ○───           [ Configure ]   │
│                        │                                                     │
│                        │   💬 Discord        ○───           [ Configure ]   │
│                        │                                                     │
├────────────────────────┴────────────────────────────────────────────────────┤
│                                            [ Cancel ]  [ 💾 Save Settings ]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Notifications Options

**Events Section**

| Option           | Type   | Description                      | Default |
|------------------|--------|----------------------------------|---------|
| On Task Complete | Toggle | Thông báo khi task hoàn thành    | ON      |
| On Task Failed   | Toggle | Thông báo khi task thất bại      | ON      |
| On Review Needed | Toggle | Thông báo khi cần review         | ON      |

**Sound Section**

| Option       | Type     | Values                              | Default |
|--------------|----------|-------------------------------------|---------|
| Enable Sound | Toggle   | Bật/tắt âm thanh thông báo          | ON      |
| Preset       | Dropdown | Default, Minimal, Classic, Custom   | Default |

**External Section**

| Option   | Type   | Description              | Default |
|----------|--------|--------------------------|---------|
| Telegram | Toggle | Gửi thông báo qua Telegram | OFF     |
| Discord  | Toggle | Gửi thông báo qua Discord  | OFF     |

### Settings Menu Item States

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  NORMAL:       │  📟 Terminals          │                       │
│                text: muted                                      │
│                background: transparent                          │
│                                                                 │
│  HOVER:        │  📟 Terminals          │                       │
│                text: normal                                     │
│                background: hover-bg                             │
│                                                                 │
│  ACTIVE:       │  🎨 Appearance     ◀   │                       │
│                text: accent-color                               │
│                background: active-bg                            │
│                indicator: ◀                                     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### All Settings Options Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  🎨 APPEARANCE                                                   │
│  ├── Appearance Mode (System / Light / Dark)                    │
│  └── Color Theme (Default, Dusk, Lime, Ocean, Retro, Neo, Forest)│
│                                                                  │
│  📟 TERMINALS                                                    │
│  ├── General                                                     │
│  │   ├── Max Terminals (1-12)                                   │
│  │   ├── Default Shell (bash, zsh, fish, sh)                    │
│  │   └── Working Directory                                      │
│  ├── Behavior                                                    │
│  │   ├── Auto-scroll Output (ON/OFF)                            │
│  │   ├── Confirm Before Kill All (ON/OFF)                       │
│  │   └── Remember Terminal Layout (ON/OFF)                      │
│  ├── YOLO Mode                                                   │
│  │   ├── Enable YOLO Mode (ON/OFF)                              │
│  │   ├── Auto-approve Commands (ON/OFF)                         │
│  │   └── Skip Confirmation Prompts (ON/OFF)                     │
│  └── Display                                                     │
│      ├── Font Size (10-20)                                      │
│      ├── Font Family (JetBrains, Fira Code, Monaco, etc.)       │
│      ├── Cursor Style (Block, Underline, Bar)                   │
│      └── Cursor Blink (ON/OFF)                                  │
│                                                                  │
│  🔔 NOTIFICATIONS                                                │
│  ├── Events                                                      │
│  │   ├── On Task Complete (ON/OFF)                              │
│  │   ├── On Task Failed (ON/OFF)                                │
│  │   └── On Review Needed (ON/OFF)                              │
│  ├── Sound                                                       │
│  │   ├── Enable Sound (ON/OFF)                                  │
│  │   └── Preset (Default, Minimal, Classic, etc.)               │
│  └── External                                                    │
│      ├── Telegram (ON/OFF + Configure)                          │
│      └── Discord (ON/OFF + Configure)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Keyboard Shortcuts

| Action              | Shortcut           |
|---------------------|--------------------|
| Toggle Sidebar      | `Ctrl + B`         |
| New Terminal        | `Ctrl + T`         |
| Kill All Terminals  | `Ctrl + Shift + W` |
| Toggle YOLO Mode    | `Ctrl + Y`         |
| Open Settings       | `Ctrl + ,`         |
| Switch to Terminals | `Ctrl + 1`         |
| Switch to GitHub    | `Ctrl + 2`         |
| New Project Tab     | `Ctrl + N`         |

---

## Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   User clicks "Terminals"  ──────►  Show Terminal Grid View     │
│                                     + Terminal Action Bar        │
│                                                                  │
│   User clicks "GitHub"     ──────►  Show GitHub Integration     │
│                                     + Repo info, actions, tabs   │
│                                                                  │
│   User clicks "Settings"   ──────►  Open Settings Popup         │
│                                     (Modal overlay)              │
│                                                                  │
│   User clicks GitHub Card  ──────►  Quick actions dropdown      │
│   (above Settings)                  - View Profile               │
│                                     - Switch Account             │
│                                     - Disconnect                 │
│                                                                  │
│   User clicks ◀ button     ──────►  Collapse Sidebar            │
│                                     (240px → 60px)               │
│                                                                  │
│   User clicks ▶ button     ──────►  Expand Sidebar              │
│   (in collapsed state)              (60px → 240px)               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Sidebar Collapse Summary

| Aspect           | Expanded (240px)     | Collapsed (60px)     |
|------------------|----------------------|----------------------|
| App Logo         | 🤖 MultiClaude ◀     | 🤖 ▶                 |
| Navigation Items | Full text + icon     | Icon only            |
| User Account     | Full info card       | Icon + tooltip       |
| Settings         | ⚙️ Settings          | ⚙️ (icon only)       |
| Tooltips         | Not needed           | Show on hover        |

---

*Document Version: Final v7*
*Last Updated: January 2025*
