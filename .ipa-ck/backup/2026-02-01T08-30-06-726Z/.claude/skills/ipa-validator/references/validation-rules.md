# IPA Validation Rules

## 1. ID Format Rules

| Doc | ID Pattern | Example | Purpose |
|-----|------------|---------|---------|
| SRD | FR-XX | FR-01, FR-02 | Feature requirement |
| SRD | S-XX | S-01, S-02 | Screen |
| SRD | E-XX | E-01, E-02 | Entity |
| SRD | B-XX | B-01 | Batch |
| SRD | R-XX | R-01 | Report |
| SRD | IF-XX | IF-01 | Interface |
| SRD | D-XX | D-01, D-02 | Key Decision |

## 2. Required Sections

### SRD.md
- [ ] System Name
- [ ] System Objectives
- [ ] User Roles (RBAC)
- [ ] Feature List (FR-xx)
- [ ] Screen List (S-xx)
- [ ] Entity List (E-xx)
- [ ] Screen Flow (mermaid)
- [ ] Key Decisions (D-xx)
- [ ] IPA Checklist

### UX_SPEC.md
- [ ] CJX (Customer Journey Experience)
- [ ] Design System (colors, typography, spacing)
- [ ] Screen Specifications (S-xx refs)
- [ ] Navigation & Flow
- [ ] IPA Checklist

### INTERFACE_SPEC.md
- [ ] Overview (base URL, auth)
- [ ] Endpoint Matrix (with status)
- [ ] Endpoint Details (with traceability)
- [ ] Error Codes
- [ ] IPA Checklist

### DB_DESIGN.md
- [ ] ERD (mermaid)
- [ ] Table Definitions (E-xx refs)
- [ ] Relationships
- [ ] Indexes
- [ ] IPA Checklist

## 3. Status Values

| Status | Meaning |
|--------|---------|
| ⏳ | Spec only (not implemented) |
| ✅ | Implemented |
| 🔄 | Synced (docs match code) |

## 4. Validation Checks

### ID Uniqueness
- Each ID must be unique within category
- IDs should be sequential (FR-01, FR-02, not FR-01, FR-05)

### Section Completeness
- All required sections present
- No empty sections
- IPA Checklist at end of each doc

### Cross-References
- Every S-xx in UX_SPEC exists in SRD
- Every FR-xx in INTERFACE_SPEC exists in SRD
- Every E-xx in DB_DESIGN exists in SRD
