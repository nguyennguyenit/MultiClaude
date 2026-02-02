# Analytics Frameworks

Post-launch data analysis methods for product improvement.

## AARRR Metrics (Pirate Metrics)

| Stage | Metric | Benchmark | How to Measure |
|-------|--------|-----------|----------------|
| **Acquisition** | New signups | 100+/week | Signup events |
| **Activation** | % complete onboarding | > 40% | Onboarding completion |
| **Retention** | % active D7/D30 | > 20% D7 | Cohort analysis |
| **Referral** | % invite others | > 15% | Invitation events |
| **Revenue** | % convert to paid | > 2-5% | Payment events |

## Funnel Analysis Template

```markdown
### Funnel: [Name]

| Step | Users | Conversion | Drop-off | Issue Hypothesis |
|------|-------|------------|----------|------------------|
| 1. Landing | 1000 | 100% | - | - |
| 2. Signup | 300 | 30% | 70% | CTA unclear? |
| 3. Verify | 240 | 80% | 20% | Email delay? |
| 4. Activate | 120 | 50% | 50% | Onboarding unclear? |

**Biggest Drop-off:** Step X → Step Y
**Action:** [Improvement to test]
```

## Cohort Analysis Template

```markdown
### Retention by [Segment]

| Cohort | Size | D1 | D7 | D30 | Best Feature |
|--------|------|----|----|-----|--------------|
| Organic | 500 | 80% | 35% | 15% | Search |
| Social | 300 | 60% | 20% | 8% | Sharing |
| Referral | 200 | 90% | 50% | 25% | Collaboration |

**Insight:** [Which cohort performs best and why]
```

## A/B Test Framework

```markdown
### Test: [Name]

**Hypothesis:** [A] performs better than [B] for [metric]

**Variants:**
- A (Control): [Description]
- B (Treatment): [Description]

**Metric:** [Primary metric]
**Sample Size:** [N per variant]
**Duration:** [Days]
**Significance:** 95%

**Results:**
| Variant | Visitors | Conversions | Rate | Winner? |
|---------|----------|-------------|------|---------|
| A | 1000 | 30 | 3.0% | - |
| B | 1000 | 42 | 4.2% | ✅ +40% |

**Decision:** [Ship/Iterate/Discard]
```

## Usage Analysis Report Structure

```markdown
# Usage Analysis: [Period]

## Key Findings
1. Finding 1 (Impact: HIGH)
2. Finding 2 (Impact: MEDIUM)

## Metrics Overview
| Metric | Value | Benchmark | Status |
|--------|-------|-----------|--------|

## Recommendations
### P0 (Do First)
- Issue → Solution → Expected Impact

### P1 (Medium Priority)
- ...

## Next Steps
1. Review with team
2. Create improvement plan (/lean)
3. Ship improvements
4. Re-analyze in 30 days
```
