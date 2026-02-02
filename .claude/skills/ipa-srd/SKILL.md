---
name: ipa:srd
description: Generate SRD.md only (use /ipa:spec for full Stage 1)
user-invocable: true
argument-hint: "[feature description or lean output]"
---

> **💡 TIP:** Use `/ipa:spec` instead to generate both SRD.md + UI_SPEC.md in one step.
>
> This command is kept for granular control when you only need SRD.md.

---

## Purpose

Generate **System Requirement Definition (SRD)** following IPA (Japan) standard from raw requirements.

---

## Input

<requirements>
$ARGUMENTS
</requirements>

If empty, look for:
- `docs/requirements.md`
- `docs/PRD.md`
- Ask user for requirements

---

## Role

You are a **Business Analyst (BA)** following IPA (Information-technology Promotion Agency, Japan) guidelines:
- 要件定義 (Requirement Definition)
- Ensure traceability: FR ↔ Screen ↔ Flow ↔ Entity

---

## Output: docs/SRD.md

Generate SRD with **15 sections** (IPA standard + Key Decisions):

```markdown
# System Requirement Definition (SRD)

## 1. System Name
[Name of the system]

## 2. System Objectives
[Goals and purposes]

## 3. User Roles (RBAC)
| Role ID | Role Name | Description | Permissions |
|---------|-----------|-------------|-------------|
| R-01 | Admin | System administrator | Full access |
| R-02 | User | Regular user | Limited access |

## 4. Feature List
| FR-ID | Feature Name | Description | Priority | Screens |
|-------|--------------|-------------|----------|---------|
| FR-01 | User Login | Authentication | High | S-01 |

## 5. Screen List
| S-ID | Screen Name | Description | Features |
|------|-------------|-------------|----------|
| S-01 | Login | User login form | FR-01 |

## 6. Batch List
| B-ID | Batch Name | Description | Schedule |
|------|------------|-------------|----------|
| B-01 | Daily Report | Generate daily report | 00:00 |

## 7. Report List
| R-ID | Report Name | Description | Format |
|------|-------------|-------------|--------|
| R-01 | User Report | User statistics | PDF |

## 8. Integration List (I/F)
| IF-ID | Name | Type | Description |
|-------|------|------|-------------|
| IF-01 | Payment Gateway | External API | Process payments |

## 9. Entity List & ER Diagram
| E-ID | Entity Name | Description |
|------|-------------|-------------|
| E-01 | User | System user |

## 10. Screen Flow
[Mermaid flowchart]

## 11. Main Business Flows
[Description of main flows]

## 12. Use Cases
| UC-ID | Name | Actor | Precondition | Flow | Postcondition |
|-------|------|-------|--------------|------|---------------|

## 13. Non-Functional Requirements (NFR)
- Performance: [requirements]
- Security: [requirements]
- Scalability: [requirements]

## 14. Key Decisions
| D-ID | Decision | Context | Alternatives | Chosen | Rationale |
|------|----------|---------|--------------|--------|-----------|
| D-01 | Database | Need data persistence | PostgreSQL, MongoDB, MySQL | TBD | TBD |
| D-02 | Auth Method | User authentication | JWT, Session, OAuth | TBD | TBD |

## 15. IPA Checklist
- [ ] All features covered
- [ ] ID consistency (FR-xx, S-xx, E-xx, D-xx)
- [ ] ERD + Screen Flow present
- [ ] NFR defined
- [ ] Key decisions documented
- [ ] Acceptance criteria defined
```

---

## Rules

- **No fabrication**: Only document what's in requirements
- **Consistent IDs**: FR-xx, S-xx, B-xx, R-xx, IF-xx, E-xx
- **Traceability**: FR ↔ Screen ↔ Flow ↔ Entity must trace back

---

## After Generation

1. Save to `docs/SRD.md`
2. Ask user to review
3. Proceed to `/ipa:bd` for Basic Design

**IMPORTANT:** Do not implement code. Only generate documentation.
