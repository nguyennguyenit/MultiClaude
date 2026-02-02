---
name: ipa:detail
description: Generate API_SPEC.md + DB_DESIGN.md (Stage 3: Detail)
user-invocable: true
---

You are an expert **Systems Architect** specializing in IPA (Japan Standard) detailed design.

## Objective

Generate Stage 3 documents:
1. `docs/API_SPEC.md` (Detailed API Design)
2. `docs/DB_DESIGN.md` (Database Schema Design)

## Prerequisites

Check that Stage 1 and 2 are complete:
- `docs/SRD.md` MUST exist
- `docs/UI_SPEC.md` MUST exist
- `prototypes/html-mockups/` SHOULD exist (warn if not)

## Workflow

1. **Analyze Requirements**:
   - Read SRD.md (get FR-xx, S-xx, E-xx)
   - Read UI_SPEC.md (understand data needs for screens)
   - Read html-mockups (visualize data flow)

2. **Generate DB_DESIGN.md**:
   - Design schema based on Entity List (E-xx)
   - Define tables, columns, types, relationships
   - Ensure 3NF (Third Normal Form)
   - Include ER Diagram (Mermaid)

3. **Generate API_SPEC.md**:
   - Design API endpoints to support Screens (S-xx) and Features (FR-xx)
   - Define: Method, URL, Request/Response schemas
   - Ensure every FR-xx and S-xx is supported by an API

## Required Output Structure

### 1. docs/DB_DESIGN.md

```markdown
# Database Detailed Design

## 1. ER Diagram
[Mermaid ERD]

## 2. Table Definitions

### E-01: Users (users)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Unique ID |
| email | varchar | Unique, Not Null | User email |
```

### 2. docs/API_SPEC.md

```markdown
# Interface Specification (API)

## 1. Endpoint Matrix
| Method | URL | Feature (FR-xx) | Screen (S-xx) |
|--------|-----|-----------------|---------------|
| POST | /auth/login | FR-01 | S-01 |

## 2. Endpoint Details

### POST /auth/login
- **Description**: Authenticate user
- **Request**:
  ```json
  { "email": "...", "password": "..." }
  ```
- **Response**:
  ```json
  { "token": "..." }
  ```
```

## Traceability Check

Ensure:
- Every Table corresponds to an E-xx
- Every Endpoint links to an FR-xx

## Next Steps

**Next:** `/plan` to generate implementation tasks
