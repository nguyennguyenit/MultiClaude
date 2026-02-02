---
name: ipa:import
description: Import external SRS/requirements document into IPA workflow
user-invocable: true
---

## Purpose

Import external requirements documents (from Gemini Deep Research, Perplexity, manual SRS) into IPA documentation structure with proper IDs and traceability.

---

## Usage

```bash
# Import from markdown file
/ipa:import @path/to/external-srs.md

# Import from PDF (uses AI vision)
/ipa:import @path/to/requirements.pdf

# Import with specific focus
/ipa:import @external.md --focus=api    # Only API requirements
/ipa:import @external.md --focus=ui     # Only UI requirements
```

---

## Workflow

### Step 1: Read External Document

1. Read external SRS file (md/pdf)
2. Analyze structure and identify sections:
   - Business requirements
   - Functional requirements
   - UI/UX specifications
   - API requirements
   - Data/Database requirements
   - Non-functional requirements

### Step 2: Extract and Categorize

Map external content to IPA docs:

| External Content | → | IPA Doc |
|------------------|---|---------|
| Business requirements | → | `SRD.md` (FR-xx) |
| User stories | → | `SRD.md` (FR-xx) |
| UI mockup descriptions | → | `UI_SPEC.md` (S-xx) |
| Screen flows | → | `UI_SPEC.md` (flows) |
| API endpoints | → | `API_SPEC.md` (API-xx) |
| Data models | → | `DB_DESIGN.md` (D-xx) |
| ERD descriptions | → | `DB_DESIGN.md` |

### Step 3: Generate IPA IDs

Assign IPA-compliant IDs:

| Type | ID Format | Example |
|------|-----------|---------|
| Functional Requirement | FR-XXX | FR-001, FR-002 |
| Screen | S-XX | S-01, S-02 |
| Entity | E-XX | E-01, E-02 |
| API Endpoint | API-XXX | API-001, API-002 |
| Database Table | D-XX | D-01, D-02 |

### Step 4: Generate IPA Docs

Create/update IPA docs:

```
/ipa:import @external-srs.md
    ↓
docs/
├── SRD.md           # Generated with FR-xx IDs
├── UI_SPEC.md       # Generated with S-xx IDs
├── API_SPEC.md      # Generated with API-xx IDs
└── DB_DESIGN.md     # Generated with D-xx IDs
```

### Step 5: Validate

Run `/ipa:validate` automatically to check:
- ID uniqueness
- Traceability links
- Required fields

---

## Output Format

### SRD.md Structure

```markdown
# Software Requirements Document

## Source
- **Imported from:** {external file name}
- **Import date:** {date}
- **Original author:** {if detected}

## Functional Requirements

### FR-001: {Requirement Title}
- **Priority:** P1/P2/P3
- **Description:** {extracted from external}
- **Source:** External SRS Section 2.1
- **Acceptance Criteria:**
  - [ ] {criteria}

### FR-002: ...
```

### Traceability Matrix

Auto-generate in each doc:

```markdown
## Traceability

| FR | Screen | API | DB |
|----|--------|-----|-----|
| FR-001 | S-01 | API-001 | D-01 |
| FR-002 | S-01, S-02 | API-002 | D-01 |
```

---

## Merge Mode

If IPA docs already exist:

```bash
# Merge with existing (default)
/ipa:import @external.md

# Replace existing (with backup)
/ipa:import @external.md --replace

# Append only new requirements
/ipa:import @external.md --append
```

Merge behavior:
1. Read existing IPA docs
2. Find max ID (e.g., FR-015)
3. Start new IDs from FR-016
4. Preserve existing content
5. Add new content at end

---

## Important

- **Preserve source:** Always note original source in generated docs
- **ID continuity:** Don't overwrite existing IDs in merge mode
- **Validate:** Always run /ipa:validate after import
- **Human review:** Import is ~80% accurate, human review recommended

**IMPORTANT:** This command reads external docs and generates IPA docs. Does not implement code.
