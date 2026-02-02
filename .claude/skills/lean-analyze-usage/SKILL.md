---
name: lean:analyze-usage
description: Analyze post-launch usage data to generate improvement recommendations
user-invocable: true
argument-hint: "[analytics-source or csv-file or \"manual\"]"
---

## Purpose

Generate usage analysis report from analytics data to inform next iteration.

Output: `plans/reports/usage-analysis-{date}.md`

## Input

<analytics-source>
$ARGUMENTS
</analytics-source>

Supported:
- CSV file path (exported from GA, Mixpanel, etc.)
- "manual" (guided input via AskUserQuestion)

## Role

You are a **Product Analyst** specializing in:
- Usage pattern analysis (feature adoption, drop-offs)
- Funnel optimization (conversion bottlenecks)
- Cohort analysis (retention, segmentation)
- A/B test interpretation

## Workflow

### Step 1: Collect Data

**If CSV provided:**
- Read and parse CSV
- Extract: user_id, event, timestamp, properties

**If "manual":**
Use AskUserQuestion:
- Total users (DAU/WAU/MAU)
- Key events (signups, activations, feature usage)
- Funnels (conversion rates)
- Retention (D1, D7, D30)

### Step 2: Analyze Patterns

**Feature Usage:**
- Most/least used features
- Power users vs casual users

**Drop-off Analysis:**
- Where users abandon flows
- Conversion rate per step

**Retention:**
- % return after 1/7/30 days
- Which cohorts retain better

**Correlations:**
- Features → retention correlation
- Acquisition source → conversion

### Step 3: Generate Report

```markdown
# Usage Analysis Report

**Period:** {start} to {end}
**Generated:** {date}

---

## Executive Summary

**Key Findings:**
1. Finding 1 (Impact: HIGH)
2. Finding 2 (Impact: MEDIUM)
3. Finding 3 (Impact: LOW)

**Top Opportunity:** [Highest impact improvement]

---

## Metrics Overview

| Metric | Value | Benchmark | Status |
|--------|-------|-----------|--------|
| MAU | X | 1,000+ | ✅/⚠️ |
| Signup → Activation | X% | 40%+ | ✅/⚠️ |
| D7 Retention | X% | 20%+ | ✅/⚠️ |

---

## Feature Adoption

| Feature | Users | % of Total | Trend |
|---------|-------|------------|-------|
| Dashboard | X | X% | ↑/→/↓ |
| Search | X | X% | ↑/→/↓ |

**Insight:** [Underutilized features, opportunities]

---

## Funnel Analysis

### [Funnel Name]

| Step | Users | Conversion | Drop-off |
|------|-------|------------|----------|
| 1. Landing | X | 100% | - |
| 2. Signup | X | X% | X% |
| 3. Activate | X | X% | X% |

**Biggest Drop-off:** Step X → Y
**Recommendation:** [Improvement]

---

## Cohort Retention

| Source | Users | D1 | D7 | D30 | Quality |
|--------|-------|----|----|-----|---------|
| Organic | X | X% | X% | X% | HIGH/MED/LOW |

**Insight:** [Best performing cohorts]

---

## Recommendations

### P0 (Do First)

**1. [Issue Title]**
- Issue: [Problem]
- Root Cause: [Why]
- Solution: [Fix]
- Expected Impact: [Metric improvement]

### P1 (Medium Priority)

**2. [Issue Title]**
- ...

### P2 (Low Priority)

**3. [Issue Title]**
- ...

---

## Next Steps

1. Review with team
2. Create improvement plan: `/lean [improvement]`
3. Implement P0 recommendations
4. Re-analyze in 30 days

---

## Data Sources

- Platform: {name}
- Date Range: {range}
- Limitations: {data quality notes}
```

## Integration

```
Launch MVP
    ↓
Collect usage data (30+ days)
    ↓
/lean:analyze-usage → plans/reports/usage-analysis-{date}.md
    ↓
/lean [improvement] → Next iteration
    ↓
/plan → Implement improvements
```
