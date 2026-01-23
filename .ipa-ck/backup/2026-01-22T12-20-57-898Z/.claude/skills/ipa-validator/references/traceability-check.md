# Traceability Check Logic

## Forward Traceability

```
SRD.md
├── FR-xx → INTERFACE_SPEC.md endpoints
├── S-xx → UX_SPEC.md screens
└── E-xx → DB_DESIGN.md tables
```

## Backward Traceability

```
INTERFACE_SPEC.md endpoint → FR-xx in SRD
UX_SPEC.md screen → S-xx in SRD
DB_DESIGN.md table → E-xx in SRD
```

## Validation Steps

### Step 1: Extract IDs from SRD.md
```
Parse Feature List table → FR-xx list
Parse Screen List table → S-xx list
Parse Entity List table → E-xx list
```

### Step 2: Validate UX_SPEC.md
```
Find all S-xx references in Screen Specifications
For each S-xx:
  - Verify exists in SRD Screen List
  - Report if missing
```

### Step 3: Validate INTERFACE_SPEC.md
```
Find all "Traceability: FR-xx" lines in Endpoint Details
For each FR-xx:
  - Verify exists in SRD Feature List
  - Report if missing
```

### Step 4: Validate DB_DESIGN.md
```
Find all "Traceability: E-xx" lines in Table Definitions
For each E-xx:
  - Verify exists in SRD Entity List
  - Report if missing
```

## Error Types

| Error | Severity | Description |
|-------|----------|-------------|
| ORPHAN_ID | Warning | ID in SRD not referenced elsewhere |
| MISSING_REF | Error | Referenced ID doesn't exist in SRD |
| DUPLICATE_ID | Error | Same ID used multiple times |
| BROKEN_CHAIN | Error | Traceability chain broken |
| MISSING_SECTION | Error | Required section not found |

## Report Format

```markdown
## IPA Validation Report

### Summary
- Total Features (FR): X
- Total Screens (S): X
- Total Entities (E): X
- Errors: X
- Warnings: X
- Status: PASS / FAIL

### Errors
- [ ] MISSING_REF: FR-05 in INTERFACE_SPEC not found in SRD
- [ ] DUPLICATE_ID: S-02 appears twice in SRD

### Warnings
- [ ] ORPHAN_ID: E-03 in SRD not referenced in DB_DESIGN
- [ ] ORPHAN_ID: FR-08 in SRD not referenced in INTERFACE_SPEC

### Recommendations
1. Add FR-05 to SRD Feature List
2. Remove duplicate S-02 entry
3. Add DB table for E-03 or remove from SRD

### Traceability Matrix
| SRD ID | Type | Referenced In | Status |
|--------|------|---------------|--------|
| FR-01 | Feature | INTERFACE_SPEC | ✅ |
| FR-02 | Feature | INTERFACE_SPEC | ✅ |
| S-01 | Screen | UX_SPEC | ✅ |
| E-01 | Entity | DB_DESIGN | ✅ |
```
