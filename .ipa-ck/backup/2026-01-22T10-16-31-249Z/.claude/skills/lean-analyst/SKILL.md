---
name: lean-analyst
description: Lean Software Development analysis skill - MVP definition and feature improvement
---

# Lean Analyst Skill

Provides Lean Software Development methodology for analyzing ideas and defining MVPs.

## When to Activate

- `/lean` command execution
- `/lean:user-research` command execution
- `/lean:analyze-usage` command execution
- MVP definition tasks
- Feature improvement analysis
- Post-MVP iteration planning

## Lean Software Development Principles

### The 7 Principles (Mary Poppendieck)

| # | Principle | Application |
|---|-----------|-------------|
| 1 | **Eliminate Waste** | Only build features with proven user value |
| 2 | **Amplify Learning** | Validate assumptions early, iterate fast |
| 3 | **Decide as Late as Possible** | Keep options open until necessary |
| 4 | **Deliver as Fast as Possible** | Smallest valuable increment first |
| 5 | **Empower the Team** | Trust team decisions |
| 6 | **Build Integrity In** | Quality from start, not afterthought |
| 7 | **See the Whole** | Optimize whole system, not parts |

### 7 Wastes in Software Development

| Waste | Example | How to Eliminate |
|-------|---------|------------------|
| Partially Done Work | Unfinished features | Smaller batches, complete before starting new |
| Extra Features | Features no one uses | Validate need before building |
| Relearning | Same mistakes repeated | Document decisions (D-xx in SRD) |
| Handoffs | Knowledge lost in transfers | Cross-functional teams |
| Task Switching | Context switching overhead | Focus on one thing at a time |
| Delays | Waiting for approvals | Remove blockers proactively |
| Defects | Bugs discovered late | Quality built in, early testing |

## MVP Definition Framework

### What Makes a Good MVP?

```
MVP = Minimum + Viable + Product

Minimum: Smallest feature set
Viable: Actually solves the problem
Product: Can be used by real users
```

### MVP Checklist

- [ ] Solves a real user problem
- [ ] Has clear success metrics
- [ ] Can be built in reasonable time
- [ ] Assumptions are identified
- [ ] Validation plan exists

## Feature Prioritization

### Priority Levels

| Priority | Criteria | Action |
|----------|----------|--------|
| **P1** | Core value, must have for launch | Build in MVP |
| **P2** | Important, enhances value | Build after MVP validation |
| **P3** | Nice to have | Defer, validate need first |
| **P4** | Future consideration | Document, don't build |

### Value vs Effort Matrix

```
          High Value
              │
    Build     │   Build
    Later     │   First (P1)
    (P2)      │
──────────────┼──────────────
    Don't     │   Quick
    Build     │   Wins (P1/P2)
    (P4)      │
              │
          Low Value

    High Effort ←──────→ Low Effort
```

## Assumption Validation

### Types of Assumptions

| Type | Example | How to Validate |
|------|---------|-----------------|
| **Problem** | Users have this pain | User interviews |
| **Solution** | Our approach works | Prototype testing |
| **Market** | People will pay | Landing page test |
| **Technical** | We can build it | Spike/POC |

### Validation Methods

1. **User Interviews** - Talk to 5+ potential users
2. **Prototype Testing** - Show mockups, get feedback
3. **Landing Page** - Test interest before building
4. **Concierge MVP** - Manual before automating
5. **Technical Spike** - Prove feasibility

## Phase Breakdown Rules

When creating phase breakdown in /lean output:

### Phase Sizing

| Features | Recommended Phases | Note |
|----------|-------------------|------|
| 1-3 P1 features | 1 phase | Simple MVP |
| 4-6 P1 features | 2 phases | Core → Enhancement |
| 7+ P1 features | 3+ phases | Consider re-scoping |

### Layer Detection

Based on feature types, suggest layers:
- API/Backend heavy → core.md
- UI/Frontend heavy → ui.md
- Data processing → data.md
- Both equally → core.md + ui.md

### Phase Naming Convention

```
phase-01-{focus}  # e.g., phase-01-core, phase-01-auth
phase-02-{focus}  # e.g., phase-02-enhancement
```

## Integration with IPA

### Mapping Lean → IPA

| Lean Output | IPA Input |
|-------------|-----------|
| Problem Statement | SRD Section 2 (Objectives) |
| MVP Features | SRD Section 4 (Feature List) |
| Target Users | SRD Section 3 (User Roles) |
| Assumptions | SRD Section 14 (Key Decisions) |
| Out of Scope | SRD Section 2 (Objectives - exclusions) |

---

## Data Analysis Capabilities

### User Research (Pre-Build)

| Method | Purpose | When to Use |
|--------|---------|-------------|
| **Persona Development** | Define target users | Before /lean |
| **Journey Mapping** | Map user experience | Before /ipa:bd |
| **Competitor Analysis** | Understand landscape | Before MVP definition |
| **Market Sizing** | Validate opportunity | Investment decisions |

### Usage Analytics (Post-Build)

| Method | Purpose | When to Use |
|--------|---------|-------------|
| **Behavioral Analysis** | Feature usage patterns | After launch |
| **Funnel Analysis** | Conversion bottlenecks | Optimization phase |
| **Cohort Analysis** | Segment retention | Growth phase |
| **A/B Testing** | Validate changes | Continuous |

### DA Workflow Integration

```
/lean:user-research → docs/USER_RESEARCH.md
         ↓
/lean → MVP definition (data-informed)
         ↓
/ipa:bd → UI_SPEC.md (with design rationale from research)
         ↓
Launch → Collect usage data
         ↓
/lean:analyze-usage → Improvement insights
         ↓
/lean [improvement] → Next iteration
```

### Integration Points

| DA Activity | IPA Phase | Output |
|-------------|-----------|--------|
| User Research | Before /lean | docs/USER_RESEARCH.md |
| UX Insights | During /ipa:bd | UI_SPEC.md design rationale |
| Usage Analytics | After launch | plans/reports/usage-analysis-{date}.md |

---

## References

- `references/mvp-checklist.md` - MVP definition checklist
- `references/user-research-guide.md` - Persona & journey mapping
- `references/analytics-frameworks.md` - Post-launch analytics methods
