# CJX Framework for HTML Prototypes

## Body Class Mapping

| CJX Stage | Body Class |
|-----------|------------|
| Discovery | `cjx-discovery` |
| Onboarding | `cjx-onboarding` |
| Usage | `cjx-usage` |
| Retention | `cjx-retention` |

---

## CJX Stage Animations

```css
.cjx-onboarding [data-cjx-entrance] {
  animation: fadeInUp 0.6s ease-out;
}

.cjx-usage [data-cjx-entrance] {
  animation: fadeIn 0.3s ease;
}

.cjx-retention [data-cjx-entrance] {
  animation: fadeIn 0.4s ease;
}

.cjx-discovery [data-cjx-entrance] {
  animation: fadeInUp 0.8s ease-out;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## Add `data-cjx-entrance` to:

- Login card
- Dashboard KPI grid
- Form cards
- Table containers
- Modal content

---

## CJX Design Mapping

| Stage | Pattern |
|-------|---------|
| Discovery | Bold hero, trust signals, clear value prop |
| Onboarding | Progress indicator, minimal fields, reassuring copy |
| Usage | Clean dashboard, quick actions, data visualization |
| Retention | Help accessible, feedback channels, achievement badges |

---

## Emotion to Visual Mapping

| Emotion | Color Tone | Animation |
|---------|------------|-----------|
| Curious | Vibrant | Entrance effects |
| Hesitant | Calm | Subtle guides |
| Confused | Simple | Directional cues |
| Frustrated | Neutral | Soothing transitions |
| Satisfied | Warm | Success feedback |
| Engaged | Energetic | Quick responses |
