# Phase 3: Terminals Tab

## Context

- Plan: `plans/260104-0431-ui-redesign-phase4-settings-modal/plan.md`
- Spec: `plans/UX-UI/MultiClaude-UI-UX-Design.md` (lines 434-550)
- Depends: Phase 1, 2

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 1h

Refactor TerminalSettings for modal layout with sections: General, Behavior, YOLO Mode, Display.

## Requirements

### Design Sections

**General Section**
| Option | Type | Values | Default |
|--------|------|--------|---------|
| Max Terminals | Dropdown | 1, 2, 4, 6, 8, 10, 12 | 12 |
| Default Shell | Dropdown | bash, zsh, fish, sh | bash |
| Working Directory | Dropdown | ~/, ~/Projects, Custom | ~/Projects |

**Behavior Section**
| Option | Type | Default |
|--------|------|---------|
| Auto-scroll Output | Toggle | ON |
| Confirm Before Kill All | Toggle | ON |
| Remember Terminal Layout | Toggle | ON |

**YOLO Mode Section**
| Option | Type | Default |
|--------|------|---------|
| Enable YOLO Mode | Toggle | OFF |
| Auto-approve Commands | Toggle | OFF |
| Skip Confirmation Prompts | Toggle | OFF |

**Display Section**
| Option | Type | Values | Default |
|--------|------|--------|---------|
| Font Size | Dropdown | 10-20 | 14 |
| Font Family | Dropdown | JetBrains Mono, Fira Code, Monaco | JetBrains Mono |
| Cursor Style | Dropdown | Block, Underline, Bar | Block |
| Cursor Blink | Toggle | ON |

## Architecture

```tsx
interface TerminalSettings {
  maxTerminals: number
  defaultShell: string
  workingDirectory: string
  autoScroll: boolean
  confirmKillAll: boolean
  rememberLayout: boolean
  yoloEnabled: boolean
  yoloAutoApprove: boolean
  yoloSkipConfirm: boolean
  fontSize: number
  fontFamily: string
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
}
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `src/renderer/components/settings/terminal-settings.tsx` | New layout |
| `src/renderer/stores/settings-store.ts` | Add terminal settings |
| `src/shared/types/index.ts` | Add TerminalSettings type |

## Implementation Steps

### Step 1: Add Types

```tsx
// src/shared/types/index.ts
export interface TerminalConfig {
  maxTerminals: number
  defaultShell: string
  workingDirectory: string
  autoScroll: boolean
  confirmKillAll: boolean
  rememberLayout: boolean
  fontSize: number
  fontFamily: string
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
}
```

### Step 2: Refactor TerminalSettings

```tsx
// terminal-settings.tsx
export function TerminalSettings() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Terminals"
        description="Configure terminal behavior and display"
      />

      {/* General Section */}
      <SettingsSection title="General">
        <SelectField label="Max Terminals" options={[1,2,4,6,8,10,12]} />
        <SelectField label="Default Shell" options={['bash','zsh','fish','sh']} />
        <SelectField label="Working Directory" options={['~/','~/Projects','Custom']} />
      </SettingsSection>

      {/* Behavior Section */}
      <SettingsSection title="Behavior">
        <ToggleField label="Auto-scroll Output" />
        <ToggleField label="Confirm Before Kill All" />
        <ToggleField label="Remember Terminal Layout" />
      </SettingsSection>

      {/* YOLO Mode Section */}
      <SettingsSection title="YOLO Mode">
        <ToggleField label="Enable YOLO Mode" />
        <ToggleField label="Auto-approve Commands" />
        <ToggleField label="Skip Confirmation Prompts" />
      </SettingsSection>

      {/* Display Section */}
      <SettingsSection title="Display">
        <SelectField label="Font Size" options={[10,11,12,13,14,15,16,18,20]} />
        <SelectField label="Font Family" options={['JetBrains Mono','Fira Code','Monaco','Consolas']} />
        <SelectField label="Cursor Style" options={['Block','Underline','Bar']} />
        <ToggleField label="Cursor Blink" />
      </SettingsSection>
    </div>
  )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-medium mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SelectField({ label, options }: { label: string; options: (string|number)[] }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <select className="bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] rounded px-3 py-1 text-sm">
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}

function ToggleField({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button className="w-10 h-5 bg-[var(--mc-accent)] rounded-full relative">
        <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
      </button>
    </div>
  )
}
```

## Todo List

- [ ] Add TerminalConfig type
- [ ] Add terminal settings to store
- [ ] Create SettingsSection component
- [ ] Create SelectField component
- [ ] Create ToggleField component
- [ ] Refactor TerminalSettings layout
- [ ] Wire up all settings to store
- [ ] Test all dropdowns and toggles

## Success Criteria

- [ ] All 4 sections display correctly
- [ ] Dropdowns show correct options
- [ ] Toggles work with visual feedback
- [ ] Settings persist on change
- [ ] Matches design spec layout

## Next Steps

Proceed to Phase 4: Integration
