# Chart Examples for HTML Prototypes

**NEVER use placeholder text for charts.** Generate REAL SVG visualizations.

---

## Line Chart (Cost Trend)

```html
<svg class="line-chart" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
  <!-- Grid lines -->
  <g class="grid">
    <line x1="50" y1="250" x2="750" y2="250" stroke="#e0e0e0"/>
    <line x1="50" y1="200" x2="750" y2="200" stroke="#e0e0e0" stroke-dasharray="4"/>
    <line x1="50" y1="150" x2="750" y2="150" stroke="#e0e0e0" stroke-dasharray="4"/>
    <line x1="50" y1="100" x2="750" y2="100" stroke="#e0e0e0" stroke-dasharray="4"/>
  </g>
  <!-- Data line -->
  <polyline
    fill="none"
    stroke="#1976d2"
    stroke-width="3"
    points="100,220 200,200 300,180 400,150 500,160 600,120 700,100"
  />
  <!-- Data points -->
  <g class="data-points">
    <circle cx="100" cy="220" r="6" fill="#1976d2"/>
    <circle cx="200" cy="200" r="6" fill="#1976d2"/>
    <circle cx="300" cy="180" r="6" fill="#1976d2"/>
    <circle cx="400" cy="150" r="6" fill="#1976d2"/>
    <circle cx="500" cy="160" r="6" fill="#1976d2"/>
    <circle cx="600" cy="120" r="6" fill="#1976d2"/>
    <circle cx="700" cy="100" r="6" fill="#1976d2"/>
  </g>
</svg>
```

---

## Donut/Pie Chart (Service Breakdown)

```html
<svg class="donut-chart" viewBox="0 0 200 200">
  <!-- Background circle -->
  <circle cx="100" cy="100" r="80" fill="none" stroke="#e0e0e0" stroke-width="30"/>
  <!-- Data segments (stroke-dasharray = segment size, remaining) -->
  <circle cx="100" cy="100" r="80" fill="none" stroke="#1976d2" stroke-width="30"
          stroke-dasharray="150 350" transform="rotate(-90 100 100)"/>
  <circle cx="100" cy="100" r="80" fill="none" stroke="#2e7d32" stroke-width="30"
          stroke-dasharray="100 400" stroke-dashoffset="-150" transform="rotate(-90 100 100)"/>
  <circle cx="100" cy="100" r="80" fill="none" stroke="#ed6c02" stroke-width="30"
          stroke-dasharray="80 420" stroke-dashoffset="-250" transform="rotate(-90 100 100)"/>
  <circle cx="100" cy="100" r="80" fill="none" stroke="#9c27b0" stroke-width="30"
          stroke-dasharray="70 430" stroke-dashoffset="-330" transform="rotate(-90 100 100)"/>
  <!-- Center text -->
  <text x="100" y="95" text-anchor="middle" font-size="12" fill="#666">Total</text>
  <text x="100" y="115" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">$45,872</text>
</svg>
```

---

## Bar Chart (Region Breakdown)

```html
<svg class="bar-chart" viewBox="0 0 400 200">
  <g class="bars">
    <rect x="30" y="30" width="60" height="120" fill="#1976d2" rx="4"/>
    <rect x="110" y="60" width="60" height="90" fill="#42a5f5" rx="4"/>
    <rect x="190" y="90" width="60" height="60" fill="#64b5f6" rx="4"/>
    <rect x="270" y="110" width="60" height="40" fill="#90caf9" rx="4"/>
  </g>
  <g class="labels" font-size="11" fill="#666">
    <text x="60" y="170" text-anchor="middle">us-east-1</text>
    <text x="140" y="170" text-anchor="middle">us-west-2</text>
    <text x="220" y="170" text-anchor="middle">eu-west-1</text>
    <text x="300" y="170" text-anchor="middle">ap-northeast</text>
  </g>
</svg>
```

---

## Progress Bar (Provider Distribution)

```html
<div class="progress-bar-container">
  <div class="provider-row">
    <span class="provider-badge aws">A</span>
    <span class="provider-name">AWS</span>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 62%; background: #ff9900;"></div>
    </div>
    <span class="provider-value">$28,420 (62%)</span>
  </div>
  <div class="provider-row">
    <span class="provider-badge azure">Az</span>
    <span class="provider-name">Azure</span>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 26%; background: #0078d4;"></div>
    </div>
    <span class="provider-value">$12,150 (26%)</span>
  </div>
  <div class="provider-row">
    <span class="provider-badge gcp">G</span>
    <span class="provider-name">GCP</span>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 12%; background: #4285f4;"></div>
    </div>
    <span class="provider-value">$5,302 (12%)</span>
  </div>
</div>
```
