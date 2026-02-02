---
name: ipa-context-aware-planning
description: Context-aware planning with @path syntax for design mockup integration and tech-stack-aware code generation
---

# Context-Aware Planning

Extends planning workflow with @path context reference parsing, design mockup analysis, and tech-stack-aware code generation.

## Activation

This skill activates when planning commands detect:
- `@path` syntax in arguments (e.g., `@docs/design-mockups`)
- Keywords: "design", "mockup", "prototype", "UI" with file references

## Syntax

| Pattern | Example | Description |
|---------|---------|-------------|
| `@folder` | `@docs/design` | Include entire folder as context |
| `@file` | `@docs/spec.md` | Include single file |
| Multiple | `@docs/design @docs/api` | Space-separated refs |

## Workflow

### 0. Tech Stack Detection (FIRST)
Load: `references/tech-stack-adaptation.md`

Detect target framework from project docs:
1. Read `.claude/tech-stack.md` (PRIMARY)
2. Fallback: `CLAUDE.md`, `docs/tech-stack.md`, `docs/project-overview-pdr.md`
3. Extract frontend framework (Next.js, React, Vue, Angular, Astro, Svelte)
4. Set transformation rules for output code

### 1. Context Parsing
Load: `references/context-parsing.md`

Parse @path references from arguments:
1. Extract all @path patterns using regex
2. Validate each path exists
3. Categorize files by type (design/docs/config)
4. Build structured context object

### 2. Design Analysis (if HTML/CSS/JS detected)
Load: `references/design-analysis.md`

Hybrid analysis workflow:
1. Screenshot HTML via `ai-multimodal` skill
2. Parse HTML structure and CSS variables
3. Extract component inventory, colors, typography
4. Extract FULL content (text, SVGs, exact classes)
5. Generate design-analysis-report.md

### 3. Code Transformation
Apply tech-stack rules to extracted code:
- Transform `class` → `className` (React/Next.js) or keep as `class`
- Adapt icon imports for target library
- Generate correct component file extensions
- Apply framework-specific patterns

### 4. Integration with Planning
After analysis:
1. Copy design files to `{plan-dir}/design/`
2. Save report to `{plan-dir}/reports/design-analysis-report.md`
3. Pass enriched context to planning workflow
4. Include tech-stack-adapted code in phases
5. Reference design specs in phase acceptance criteria

## Usage Example

```bash
/plan:hard implement login screen @docs/prototype/login

# Workflow:
# 1. Parse @docs/prototype/login
# 2. Find: login.html, login.css, login.js
# 3. Screenshot + analyze design
# 4. Generate report with component inventory
# 5. Create plan with design-informed tasks
```

## Output Structure

```
{plan-dir}/
├── design/
│   └── prototype/
│       ├── login.html
│       └── login.css
├── reports/
│   └── design-analysis-report.md
├── plan.md
└── phase-XX-xxx.md
```

## Dependencies

- `ai-multimodal` skill for visual capture (optional, fallback to code-only)
- Global `planning` skill (this supplements, not replaces)

## File Categorization

| Category | Extensions | Action |
|----------|------------|--------|
| design | .html, .css, .js, .jsx, .tsx, .vue, .svelte | Analyze + copy |
| docs | .md, .txt, .rst | Read as context |
| config | .json, .yaml, .yml | Read as context |
| other | * | List only |

## Error Handling

| Error | Action |
|-------|--------|
| Path not found | Warn user, continue without |
| Too many files (>50) | Warn, ask to narrow scope |
| ai-multimodal unavailable | Fallback to code-only parsing |
