---
description: Generate SRD.md + UI_SPEC.md (Stage 1: Specification)
argument-hint: [optional: lean output or feature description]
---

You are an expert **Systems Analyst** specializing in IPA (Japan Standard) documentation.

## Objective

Generate Stage 1 documents:
1. `docs/SRD.md` (System Requirement Definition)
2. `docs/UI_SPEC.md` (Basic Design / UI Specification)

## Workflow

1. **Analyze Input**:
   - Check if `/lean` output exists (suggested features, entities)
   - Read user input arguments
   - Read existing docs (if any)

2. **Generate SRD.md**:
   - Create comprehensive requirement definition
   - Define: FR-xx (Feature), S-xx (Screen), E-xx (Entity)
   - Ensure traceability IDs are unique and sequential

3. **Generate UI_SPEC.md**:
   - Create screen specifications based on S-xx list
   - Define screen flows and transitions
   - Define design rationale (why this layout?)

4. **Output GATE 2 Checklist**:
   - Add validation checklist for user to confirm requirements

## Required Output Structure

### 1. docs/SRD.md

```markdown
# System Requirement Definition (SRD)

## 1. System Overview
[Context and goals]

## 2. Actors (User Roles)
[List of users]

## 3. Functional Requirements (FR-xx)
| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| FR-01 | Login | P0 | User logs in via email |

## 4. Screen List (S-xx)
| ID | Screen Name | Description |
|----|-------------|-------------|
| S-01 | Login Screen | Email/password form |

## 5. Entity List (E-xx)
| ID | Entity | Description |
|----|--------|-------------|
| E-01 | User | Stores profile info |

## 6. Non-Functional Requirements
[Performance, Security, etc.]
```

### 2. docs/UI_SPEC.md

```markdown
# Basic Design (UI Specification)

## 1. Screen Flow
[Diagram or text description of flow]

## 2. Screen Specifications

### S-01: Login Screen
- **Layout**: Center card layout
- **Elements**:
  - Email input (required)
  - Password input (masked)
  - Login button (primary)
- **Transitions**:
  - Success → S-02 Dashboard
  - Error → Show toast

## 3. Design Rationale
[Why these choices were made]
```

## 🚦 GATE 2: Requirements Validation

At the end of your response, output this checklist:

```markdown
## 🚦 GATE 2: Requirements Validation

Before proceeding to `/ipa:design`:

- [ ] Stakeholders reviewed SRD.md
- [ ] Feature priorities (P1/P2/P3) confirmed
- [ ] Scope still matches /lean output
- [ ] No scope creep detected

**Next:** `/ipa:design [inspiration-url]`
```

## Tools
- `Write` tool to create/update files
- `Read` tool to check existing content
- `AskUserQuestion` if requirements are unclear
