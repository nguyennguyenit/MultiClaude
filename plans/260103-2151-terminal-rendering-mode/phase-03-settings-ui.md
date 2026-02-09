# Phase 3: Settings UI

## Objective

Add Terminal Rendering mode selector to Settings panel.

## Tasks

### 3.1 Add Rendering Mode Selector

**File**: `src/renderer/components/settings/theme-selector.tsx`

Add import for new type (line 3):

```typescript
import type { ThemeMode, TerminalRenderMode } from '@shared/types'
```

Update store destructure (line 6):

```typescript
const { settings, setThemeMode, setColorTheme, setTerminalRenderMode } = useSettingsStore()
```

Add rendering mode section after the Color Theme section (after line 76, before closing `</div>`):

```tsx
{/* Terminal Rendering Mode */}
<div>
  <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Terminal Rendering</div>
  <div className="grid grid-cols-3 gap-1">
    {([
      { mode: 'performance' as TerminalRenderMode, label: 'Performance', icon: RocketIcon },
      { mode: 'balanced' as TerminalRenderMode, label: 'Balanced', icon: BalanceIcon },
      { mode: 'quality' as TerminalRenderMode, label: 'Quality', icon: SparkleIcon }
    ]).map(({ mode, label, icon: Icon }) => (
      <button
        key={mode}
        onClick={() => setTerminalRenderMode(mode)}
        className={`
          flex flex-col items-center gap-1 p-2 rounded text-xs
          ${settings.terminalRenderMode === mode
            ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
            : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'
          }
        `}
      >
        <Icon />
        {label}
        {mode === 'balanced' && (
          <span className="text-[10px] opacity-70">Recommended</span>
        )}
      </button>
    ))}
  </div>
  <p className="text-[10px] text-[var(--mc-text-muted)] mt-1">
    Use Performance if experiencing lag with multiple terminals
  </p>
</div>
```

### 3.2 Add Icon Components

**File**: `src/renderer/components/settings/theme-selector.tsx`

Add icon components at the end of file (after `SystemIcon`):

```tsx
function RocketIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

function BalanceIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  )
}
```

## Verification

After Phase 3:
- [ ] Settings panel shows "Terminal Rendering" section
- [ ] 3 buttons: Performance, Balanced, Quality
- [ ] "Balanced" shows "Recommended" label
- [ ] Clicking buttons updates the setting
- [ ] Active mode shows accent color highlight
- [ ] Hint text visible below buttons

## Code Diff Preview

### src/renderer/components/settings/theme-selector.tsx

```diff
 import { useSettingsStore } from '../../stores'
 import { COLOR_THEMES } from '@shared/constants'
-import type { ThemeMode } from '@shared/types'
+import type { ThemeMode, TerminalRenderMode } from '@shared/types'

 export function ThemeSelector() {
-  const { settings, setThemeMode, setColorTheme } = useSettingsStore()
+  const { settings, setThemeMode, setColorTheme, setTerminalRenderMode } = useSettingsStore()

   ...

       </div>

+      {/* Terminal Rendering Mode */}
+      <div>
+        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Terminal Rendering</div>
+        <div className="grid grid-cols-3 gap-1">
+          {([
+            { mode: 'performance' as TerminalRenderMode, label: 'Performance', icon: RocketIcon },
+            { mode: 'balanced' as TerminalRenderMode, label: 'Balanced', icon: BalanceIcon },
+            { mode: 'quality' as TerminalRenderMode, label: 'Quality', icon: SparkleIcon }
+          ]).map(({ mode, label, icon: Icon }) => (
+            <button
+              key={mode}
+              onClick={() => setTerminalRenderMode(mode)}
+              className={`
+                flex flex-col items-center gap-1 p-2 rounded text-xs
+                ${settings.terminalRenderMode === mode
+                  ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
+                  : 'bg-[var(--mc-bg-hover)] hover:bg-[var(--mc-bg-active)] text-[var(--mc-text-primary)]'
+                }
+              `}
+            >
+              <Icon />
+              {label}
+              {mode === 'balanced' && (
+                <span className="text-[10px] opacity-70">Recommended</span>
+              )}
+            </button>
+          ))}
+        </div>
+        <p className="text-[10px] text-[var(--mc-text-muted)] mt-1">
+          Use Performance if experiencing lag with multiple terminals
+        </p>
+      </div>
     </div>
   )
 }

 ...

+function RocketIcon() {
+  return (
+    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
+      <path strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
+    </svg>
+  )
+}
+
+function BalanceIcon() {
+  return (
+    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
+      <path strokeWidth="2" d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" />
+    </svg>
+  )
+}
+
+function SparkleIcon() {
+  return (
+    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
+      <path strokeWidth="2" d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
+    </svg>
+  )
+}
```

## Screenshot Reference

```
┌─────────────────────────────────────────┐
│ Settings                           [X]  │
├─────────────────────────────────────────┤
│ [Appearance] [Notifications]            │
├─────────────────────────────────────────┤
│ APPEARANCE                              │
│ ┌─────────┬─────────┬─────────┐         │
│ │ System  │  Light  │  Dark   │         │
│ └─────────┴─────────┴─────────┘         │
│                                         │
│ COLOR THEME                             │
│ ┌─────────────┬─────────────┐           │
│ │ ●○ Default  │ ●○ Dusk     │           │
│ ├─────────────┼─────────────┤           │
│ │ ●○ Lime     │ ●○ Ocean    │           │
│ ├─────────────┼─────────────┤           │
│ │ ●○ Retro    │ ●○ Neo      │           │
│ ├─────────────┼─────────────┤           │
│ │ ●○ Forest   │             │           │
│ └─────────────┴─────────────┘           │
│                                         │
│ TERMINAL RENDERING                      │ ← NEW
│ ┌───────────┬───────────┬───────────┐   │
│ │    🚀     │    ⚖️     │    ✨     │   │
│ │Performance│ Balanced  │  Quality  │   │
│ │           │Recommended│           │   │
│ └───────────┴───────────┴───────────┘   │
│ Use Performance if experiencing lag...  │
└─────────────────────────────────────────┘
```

---

*Phase 3 of 4*
