---
name: lean:user-research
description: Generate user research documentation (personas, journey maps) before MVP definition
user-invocable: true
argument-hint: "[target-users or problem-space]"
---

## Purpose

Generate **docs/USER_RESEARCH.md** with personas and journey maps to inform /lean MVP definition and /ipa:bd UX design.

## Input

<context>
$ARGUMENTS
</context>

Examples:
- "SaaS product managers struggling with tool fragmentation"
- "Small business owners managing inventory manually"

## Role

You are a **User Researcher** specializing in:
- Persona development (demographics, behaviors, goals, pain points)
- Customer journey mapping (touchpoints, emotions, opportunities)
- Empathy-driven design

## Workflow

### Step 1: Clarify Context

Use AskUserQuestion to gather:
- Who is the target user? (role, demographics)
- What problem are they experiencing?
- What do they currently use?
- What constraints do they have?

### Step 2: Research

**If needed:**
- WebSearch for competitor analysis
- WebSearch for industry trends
- ai-multimodal to analyze competitor screenshots

### Step 3: Generate Personas (2-3)

```markdown
### Persona 1: [Name + Archetype]

**Demographics:**
- Age: [range]
- Role: [job title]
- Location: [geography]

**Behaviors:**
- [Key activities]
- [Tool patterns]

**Goals:**
- [Primary]
- [Secondary]

**Pain Points:**
- [Frustration 1]
- [Frustration 2]

**Quote:** "[Mindset statement]"
**Tech Savviness:** [Low/Medium/High]
```

### Step 4: Map Customer Journey

For primary persona, map 5 stages:

```markdown
### Stage 1: Discovery
**Touchpoint:** [Where they encounter product]
**Emotion:** [Feeling]
**Actions:** [What they do]
**Pain Points:** [Frustrations]
**Opportunities:** [Improvements]
**Design Implications:** [UI/UX decisions]
```

Stages: Discovery → Onboarding → Usage → Retention → Advocacy

### Step 5: Output docs/USER_RESEARCH.md

```markdown
# User Research

**Generated:** {date}
**Context:** {problem-space}

---

## Executive Summary

**Target Users:** [Description]
**Key Insights:**
- Insight 1
- Insight 2

---

## Personas

[Persona 1]
[Persona 2]

---

## Customer Journey Map

[Journey for primary persona]

---

## Competitor Landscape

| Competitor | Features | Strengths | Weaknesses | Differentiation |
|------------|----------|-----------|------------|-----------------|

---

## Assumptions to Validate

- [ ] Assumption 1 (validate via...)
- [ ] Assumption 2 (validate via...)

---

## Next Steps

1. Use personas in /lean MVP definition
2. Map journey stages to screens in /ipa:bd
3. Validate assumptions via interviews/testing
```

## Integration

**Before /lean:**
```
/lean:user-research "target users"
  ↓
docs/USER_RESEARCH.md
  ↓
/lean → reads USER_RESEARCH.md → data-informed MVP
```

**In /ipa:bd:**
- Read USER_RESEARCH.md
- Map journey stages to screens
- Add design rationale based on persona insights
