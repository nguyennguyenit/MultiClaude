---
name: ipa:dd
description: Generate API_SPEC.md + DB_DESIGN.md (alias for /ipa:detail)
user-invocable: true
---

> **💡 TIP:** `/ipa:detail` is the new canonical name for this command.
>
> Both commands produce the same output. `/ipa:dd` is kept for backward compatibility.

---

## Purpose

Generate **Detail Design (内部設計)** following IPA standard.
**Platform Agnostic** - works with any project type.

Output:
- `docs/INTERFACE_SPEC.md` - Interface specifications (API/CLI/MCP/Chat)
- `docs/DB_DESIGN.md` - Data design (SQL/NoSQL/Vector/File)

---

## Project Type Detection

| Project Type | Interface Spec | Data Design |
|--------------|----------------|-------------|
| **Web App** | REST/GraphQL API | SQL/NoSQL |
| **Desktop App** | IPC/Native API | SQLite/Local |
| **CLI Tool** | Commands/Args/Flags | Config files |
| **MCP Server** | Tools/Resources/Prompts | - |
| **Chatbot/RAG** | Conversation flows | Vector DB |
| **Library/SDK** | Public API/Methods | - |

---

## Input

**Required:**
- `docs/SRD.md`
- `docs/UI_SPEC.md`

**Optional:**
- `docs/tech-stack.md` (for implementation hints only, not required)

---

## Language-Agnostic Principle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LANGUAGE-AGNOSTIC DESIGN                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  API_SPEC.md uses:                                                  │
│  - OpenAPI 3.x standard (YAML/JSON)                                │
│  - Standard HTTP methods (GET, POST, PUT, DELETE)                  │
│  - JSON Schema for request/response                                │
│  - NO framework-specific code                                       │
│                                                                     │
│  DB_DESIGN.md uses:                                                 │
│  - Standard SQL (DDL)                                              │
│  - ER Diagram (Mermaid)                                            │
│  - Portable data types                                              │
│  - NO ORM-specific syntax                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Workflow

1. Read `docs/SRD.md` for entities and features
2. Read `docs/UI_SPEC.md` for screen → API mapping
3. Generate `docs/API_SPEC.md` (OpenAPI standard)
4. Generate `docs/DB_DESIGN.md` (SQL standard)
5. Optionally add implementation notes if tech-stack.md exists
6. Ask user to review

---

## After Generation

1. Save to `docs/API_SPEC.md` and `docs/DB_DESIGN.md`
2. Verify traceability: API ↔ Screen ↔ Feature ↔ Entity
3. Ask user to review
4. Ready for `/plan` to create implementation tasks

**IMPORTANT:** Do not implement code. Only generate documentation.
