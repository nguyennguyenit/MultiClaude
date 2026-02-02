# Layout Patterns for HTML Prototypes

## Class Naming Convention (MANDATORY)

| Purpose | Class Name | CSS |
|---------|------------|-----|
| App wrapper | `app-layout` | `display: flex; min-height: 100vh` |
| Main content | `main-content` | `flex: 1; margin-left: var(--sidebar-width)` |
| Left sidebar | `sidebar` | Add `hide-mobile` for responsive |
| KPI cards grid | `kpi-grid` | `grid-template-columns: repeat(4, 1fr)` |
| Chart container | `chart-card` | Standard card styling |
| Data table | `table-container` | Overflow handling |

**DO NOT USE:** `app-container`, `main-area`, `dashboard-layout`, `optimization-kpis`
**USE INSTEAD:** `app-layout`, `main-content`, `app-layout`, `kpi-grid`

---

## Region Explorer Pattern (S-12 Resources)

```
CORRECT:
+--------+------------------------------+
| NAV    | [Region Explorer] [Global]   |
|        |------------------------------|
|        | US East | US West | EU       |
|        |------------------------------|
|        | Resources for selected region|
+--------+------------------------------+

WRONG (DO NOT USE):
Sidebar list with regions as nested menu items
```

### Region Card Pattern

```html
<div class="region-grid">
  <div class="region-card" data-region="us-east-1">
    <span class="region-flag">US</span>
    <span class="region-name">US East</span>
    <span class="region-count">24 resources</span>
  </div>
  <!-- More cards... -->
</div>
```

```css
.region-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}
.region-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.region-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

---

## Responsive Pattern

```html
<nav class="sidebar hide-mobile">...</nav>
```

```css
@media (max-width: 767px) {
  .hide-mobile { display: none; }
  .main-content { margin-left: 0; }
}
```

---

## Chart Layout Ratios

- Trend chart: 2fr
- Breakdown chart: 1fr
- Example: `grid-template-columns: 2fr 1fr;`
