# Component Standards for HTML Prototypes

## Status Badge

```html
<span class="status-badge success">Connected</span>
<span class="status-badge error">Disconnected</span>
<span class="status-badge warning">Pending</span>
```

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 500;
}
.status-badge.success { background: rgba(46,125,50,0.1); color: var(--color-success); }
.status-badge.error { background: rgba(211,47,47,0.1); color: var(--color-error); }
.status-badge.warning { background: rgba(237,108,2,0.1); color: var(--color-warning); }
```

---

## Toggle Group

```html
<div class="toggle-group">
  <button class="toggle-btn active">Default</button>
  <button class="toggle-btn">AI</button>
</div>
```

```css
.toggle-group {
  display: flex;
  background: var(--color-grey-100);
  border-radius: var(--radius-full);
  padding: 4px;
}
.toggle-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: var(--radius-full);
  cursor: pointer;
}
.toggle-btn.active {
  background: white;
  box-shadow: var(--shadow-sm);
  color: var(--color-primary);
}
```

---

## Form Row

```html
<div class="form-row">
  <div class="form-field">...</div>
  <div class="form-field">...</div>
</div>
```

```css
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
@media (max-width: 767px) {
  .form-row { grid-template-columns: 1fr; }
}
```

---

## Login Card

```css
.login-page {
  background: linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 50%, var(--color-primary-light) 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-8);
  animation: fadeInUp 0.6s ease-out;
}
```
