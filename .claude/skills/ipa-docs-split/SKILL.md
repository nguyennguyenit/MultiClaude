---
name: ipa-docs:split
description: Split large IPA docs into modular folder structure
user-invocable: true
argument-hint: "[API_SPEC | DB_DESIGN | SRD]"
---

## Purpose

Split large IPA documentation files (API_SPEC, DB_DESIGN, SRD) into modular folder structure when files exceed 500 lines.

---

## Usage

```bash
# Split specific doc
/ipa-docs:split API_SPEC
/ipa-docs:split DB_DESIGN
/ipa-docs:split SRD

# Auto-detect and split all large docs
/ipa-docs:split
```

---

## Output Structure

### Before (Single File)
```
docs/
├── API_SPEC.md         # 800+ lines, hard to navigate
```

### After (Modular)
```
docs/
├── API_SPEC/
│   ├── README.md       # Agent guide for this folder
│   ├── index.md        # Endpoint matrix (mục lục)
│   ├── auth.md         # /auth/* endpoints
│   ├── users.md        # /users/* endpoints
│   └── orders.md       # /orders/* endpoints
```

---

## Workflow

### Step 1: Analyze Document

1. Read target doc (e.g., `docs/API_SPEC.md`)
2. Check line count:
   - < 500 lines: Skip (no split needed)
   - ≥ 500 lines: Proceed with split
3. Identify sections by headers (## or ###)

### Step 2: Create Folder Structure

1. Create folder: `docs/{DOC_NAME}/`
2. Generate `README.md`:
```markdown
# {DOC_NAME}

This folder contains modular IPA documentation split from {DOC_NAME}.md

## Files

| File | Description |
|------|-------------|
| index.md | Overview and navigation |
| {section}.md | {Section description} |

## Usage

Agent should read `index.md` first for overview, then specific files as needed.
```

### Step 3: Generate index.md

Extract matrix/overview section:
- For API_SPEC: Endpoint Matrix table
- For DB_DESIGN: Table Matrix
- For SRD: Requirements Matrix (FR-xx list)

Add links to detail files.

### Step 4: Split Content

For each major section (identified by ## headers):
1. Create `{section-slug}.md`
2. Move section content
3. Add backlink to index.md

---

## Section Detection by Doc Type

### API_SPEC.md
Split by API group:
- Sections with `/auth/*` → `auth.md`
- Sections with `/users/*` → `users.md`
- Sections with `/orders/*` → `orders.md`

### DB_DESIGN.md
Split by domain:
- User tables → `users-tables.md`
- Order tables → `orders-tables.md`
- System tables → `system-tables.md`

### SRD.md
Split by feature:
- FR-01xx → `feature-auth.md`
- FR-02xx → `feature-orders.md`

---

## Traceability Preservation

**CRITICAL:** Maintain IPA ID references across files:

- `index.md` contains full matrix with IDs
- Detail files preserve ID anchors: `### API-001: POST /auth/login {#API-001}`
- Cross-references remain valid: `See [FR-001](../SRD/index.md#FR-001)`

---

## Rollback

Original file is backed up to:
```
docs/.backup/{DOC_NAME}.md.{timestamp}
```

To restore:
```bash
mv docs/.backup/API_SPEC.md.{timestamp} docs/API_SPEC.md
rm -rf docs/API_SPEC/
```

---

## Important

- **Threshold:** Only split if file > 500 lines
- **Backup:** Always backup original before split
- **IDs:** Preserve all FR-xx, API-xx, D-xx IDs
- **Links:** Update cross-references to point to new paths

**IMPORTANT:** This command only reorganizes docs. Does not modify code.
