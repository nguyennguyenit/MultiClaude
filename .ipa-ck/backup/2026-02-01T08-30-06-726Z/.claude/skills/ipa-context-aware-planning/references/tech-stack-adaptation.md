# Tech Stack Adaptation

## Overview

Detect target frontend framework from project config and apply transformation rules to extracted design code.

## Detection Sources

Check these files in order:
1. `.claude/tech-stack.md` - Primary: Project-level tech stack (preferred location)
2. `CLAUDE.md` - Technology Stack section
3. `docs/tech-stack.md` - Alternative location
4. `docs/project-overview-pdr.md` - Project overview
5. `package.json` - Dependencies (fallback)

### Example: .claude/tech-stack.md structure

```markdown
# Project Tech Stack

## Frontend (apps/FE)
| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5.x |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **Icons** | Lucide React |
```

### Detection Patterns

| Framework | Keywords to detect |
|-----------|-------------------|
| Next.js | "next.js", "next", "app router", "pages router" |
| React | "react", "create-react-app", "vite + react" |
| Vue 3 | "vue", "vue 3", "nuxt", "composition api" |
| Angular | "angular", "ng", "standalone components" |
| Astro | "astro", "astro islands" |
| Svelte | "svelte", "sveltekit" |
| Solid.js | "solid", "solidjs", "solid-start" |
| Qwik | "qwik", "qwik city" |
| Electron | "electron" + (react/vue/vanilla) |

## Transformation Rules

### Next.js / React

```yaml
stack: nextjs | react
attribute: className
icon_library: lucide-react
icon_import: "import { IconName } from 'lucide-react'"
component_ext: .tsx
routing: app/[route]/page.tsx (Next.js) | src/pages/[route].tsx (React)
styling: className={} or CSS Modules
state: useState, useEffect, React Query
```

**Example transformation:**
```tsx
// FROM mockup HTML
<div class="glass-panel">
  <i data-lucide="brain-circuit"></i>
</div>

// TO Next.js/React
import { BrainCircuit } from 'lucide-react'

<div className="glass-panel">
  <BrainCircuit className="w-6 h-6" />
</div>
```

### Vue 3

```yaml
stack: vue3
attribute: class
icon_library: lucide-vue-next
icon_import: "import { IconName } from 'lucide-vue-next'"
component_ext: .vue
routing: src/views/[route].vue | pages/[route].vue (Nuxt)
styling: class="" or :class="{}"
state: ref(), reactive(), Pinia
```

**Example transformation:**
```vue
<template>
  <div class="glass-panel">
    <BrainCircuit class="w-6 h-6" />
  </div>
</template>

<script setup lang="ts">
import { BrainCircuit } from 'lucide-vue-next'
</script>
```

### Angular

```yaml
stack: angular
attribute: class
icon_library: lucide-angular
icon_import: "Component import + LucideAngularModule"
component_ext: .component.ts + .component.html
routing: app/[route]/[route].component.ts
styling: class="" or [ngClass]="{}"
state: signals, RxJS, NgRx
```

**Example transformation:**
```typescript
// component.ts
import { Component } from '@angular/core';
import { LucideAngularModule, BrainCircuit } from 'lucide-angular';

@Component({
  selector: 'app-login-branding',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './login-branding.component.html'
})
export class LoginBrandingComponent {
  readonly BrainCircuit = BrainCircuit;
}
```

```html
<!-- component.html -->
<div class="glass-panel">
  <lucide-icon [img]="BrainCircuit" class="w-6 h-6"></lucide-icon>
</div>
```

### Astro

```yaml
stack: astro
attribute: class
icon_library: lucide-astro or astro-icon
icon_import: "import { IconName } from 'lucide-astro'"
component_ext: .astro
routing: src/pages/[route].astro
styling: class="" (HTML-like)
state: Astro islands, client:* directives
```

**Example transformation:**
```astro
---
import { BrainCircuit } from 'lucide-astro'
---

<div class="glass-panel">
  <BrainCircuit class="w-6 h-6" />
</div>
```

### Svelte / SvelteKit

```yaml
stack: svelte
attribute: class
icon_library: lucide-svelte
icon_import: "import IconName from 'lucide-svelte/icons/icon-name'"
component_ext: .svelte
routing: src/routes/[route]/+page.svelte (SvelteKit)
styling: class=""
state: $state, stores
```

**Example transformation:**
```svelte
<script>
  import BrainCircuit from 'lucide-svelte/icons/brain-circuit'
</script>

<div class="glass-panel">
  <BrainCircuit class="w-6 h-6" />
</div>
```

### Solid.js / Solid Start

```yaml
stack: solid
attribute: class
icon_library: lucide-solid
icon_import: "import { IconName } from 'lucide-solid'"
component_ext: .tsx
routing: src/routes/[route].tsx (Solid Start)
styling: class="" or classList={{}}
state: createSignal, createStore
```

**Example transformation:**
```tsx
import { BrainCircuit } from 'lucide-solid'

<div class="glass-panel">
  <BrainCircuit class="w-6 h-6" />
</div>
```

### Qwik / Qwik City

```yaml
stack: qwik
attribute: class
icon_library: lucide-qwik (or SVG inline)
icon_import: "Inline SVG or custom component"
component_ext: .tsx
routing: src/routes/[route]/index.tsx (Qwik City)
styling: class=""
state: useSignal, useStore
```

**Example transformation:**
```tsx
import { component$ } from '@builder.io/qwik'

export default component$(() => {
  return (
    <div class="glass-panel">
      {/* Inline SVG for icons - Lucide doesn't have official Qwik package */}
      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        {/* BrainCircuit path */}
      </svg>
    </div>
  )
})
```

### Electron (Hybrid)

```yaml
stack: electron
attribute: depends on renderer (React→className, Vue→class)
icon_library: depends on renderer framework
component_ext: depends on renderer framework
routing: usually hash router or memory router
styling: framework-dependent
state: framework-dependent + IPC for main process
```

**Notes:**
- Electron uses a web renderer (React/Vue/Vanilla), detect the renderer framework
- Main process (Node.js) handles system APIs via IPC
- Preload scripts bridge renderer and main

**Example (Electron + React):**
```tsx
// renderer/components/Panel.tsx
import { BrainCircuit } from 'lucide-react'

export function Panel() {
  const handleClick = () => {
    window.electron.ipcRenderer.send('action', 'data')
  }

  return (
    <div className="glass-panel" onClick={handleClick}>
      <BrainCircuit className="w-6 h-6" />
    </div>
  )
}
```

## Output in Plan Phase

Each phase should include a **Tech Stack Adaptation** section:

```markdown
## Tech Stack Adaptation

**Detected:** Next.js 16 (from .claude/tech-stack.md)

| Aspect | Value |
|--------|-------|
| Attribute | `className` |
| Icons | `import { X } from 'lucide-react'` |
| Extension | `.tsx` |
| Routing | `app/login/page.tsx` |

### Transformed Code

[Stack-specific code blocks]
```

## Fallback Behavior

If no tech stack detected:
1. Ask user to specify framework
2. Default to React/Next.js (most common)
3. Output raw HTML as reference

## Icon Name Mapping

Convert Lucide data-lucide attribute to import:

| data-lucide | Import Name |
|-------------|-------------|
| `brain-circuit` | `BrainCircuit` |
| `arrow-right` | `ArrowRight` |
| `shield-check` | `ShieldCheck` |
| `database` | `Database` |

**Conversion rule:** kebab-case → PascalCase

## CSS Handling

CSS classes remain the same across all frameworks.
Only the attribute name changes:
- React: `className="..."`
- Others: `class="..."`

Tailwind classes work universally.
