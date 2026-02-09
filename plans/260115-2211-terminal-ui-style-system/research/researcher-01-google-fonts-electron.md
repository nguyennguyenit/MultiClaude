# Google Fonts in Electron Apps - Research Report

## 1. Loading Strategies

### Self-Hosting (Recommended for Electron)
**Why:** Offline reliability, performance, privacy (GDPR), CSP compliance

**Implementation:**
- Download fonts via [google-webfonts-helper](https://gwfh.mranix.com/fonts) or [@fontsource](https://fontsource.org/)
- Format: WOFF2 (best compression, Chromium native)
- Store: `src/assets/fonts/`

**NPM Approach (Preferred for Management):**
```bash
npm install @fontsource/jetbrains-mono @fontsource/source-code-pro
```
```js
import "@fontsource/jetbrains-mono/400.css";
```

### Loading Methods Comparison

| Method | Offline | Performance | Control | Use Case |
|--------|---------|-------------|---------|----------|
| CDN `<link>` | ❌ No | Variable (network) | Low | Not suitable for Electron |
| `@font-face` + bundled | ✅ Yes | Fast (local disk) | Full | **Required for Electron** |
| `<link rel="preload">` | ✅ Yes (local) | Faster (early fetch) | Medium | Optimization layer |
| @fontsource NPM | ✅ Yes | Fast | High | **Best for terminal apps** |

---

## 2. Monospace Fonts Performance

### Font Characteristics for xterm.js Terminals

| Font | Strengths | Drawbacks | Performance |
|------|-----------|-----------|-------------|
| **JetBrains Mono** | Large x-height, distinct chars (1/l/I), optimized for code | None significant | ⭐⭐⭐ Best all-rounder |
| **Source Code Pro** | Exceptional small-size clarity, geometric, high-DPI optimized | Wider (more horizontal space) | ⭐⭐⭐ Best for 4K/5K |
| **Fira Code** | Programming ligatures (`=>`, `!=`), reduces visual noise | Requires `@xterm/addon-ligatures`, WebGL glitches possible | ⭐⭐ Higher complexity |
| **VT323** | Retro CRT aesthetic, pixel-style | Poor readability, missing glyphs | ⭐ Aesthetic only |

### xterm.js Rendering Impact

**Canvas Renderer (Default):**
- CPU-bound, stable
- Font choice: negligible impact
- Memory: <2MB per font face

**WebGL Renderer (High-performance):**
- GPU-accelerated
- Fira Code ligatures: occasional cursor misalignment/ghosting
- JetBrains/Source Code: no issues

**Ligature Overhead (Fira Code):**
- Requires `@xterm/addon-ligatures` lookahead parsing
- Minimal CPU impact on modern hardware
- Adds processing layer vs non-ligature fonts

**Recommendation:** JetBrains Mono (performance + readability) or Source Code Pro (high-DPI clarity)

---

## 3. CSS Implementation

### @font-face (Required)
```css
@font-face {
  font-family: 'JetBrains Mono';
  src: url('./assets/fonts/jetbrains-mono-v13-latin-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap; /* Show fallback font while loading */
}
```

### Link Tag Preload (Optimization)
```html
<link rel="preload"
      href="./assets/fonts/jetbrains-mono-v13-latin-regular.woff2"
      as="font"
      type="font/woff2"
      crossorigin>
```

**Key Points:**
- Preload tells Chromium to fetch immediately (before CSS parsing)
- Still requires `@font-face` declaration
- `crossorigin` attribute required even for same-origin fonts

---

## 4. Offline Support

### CSP Configuration
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; font-src 'self';">
```

Add `data:` if using Base64-encoded fonts:
```html
font-src 'self' data:;
```

### Asset Bundling
- Vite/Webpack auto-detect `url()` references in CSS
- Fonts included in production build automatically
- No runtime network requests

---

## 5. Font Loading Detection

### FontFaceSet API (document.fonts)

**Check if font loaded:**
```js
document.fonts.check('12px "JetBrains Mono"'); // returns boolean
```

**Wait for all fonts:**
```js
document.fonts.ready.then(() => {
  console.log('All fonts loaded');
  // Safe to measure text, render terminal
});
```

**Load specific font:**
```js
document.fonts.load('400 12px "JetBrains Mono"').then(() => {
  console.log('JetBrains Mono loaded');
});
```

**Event listeners:**
```js
document.fonts.addEventListener('loadingdone', (event) => {
  console.log(`${event.fontfaces.length} fonts loaded`);
});
```

### Practical Pattern for Terminal Init
```js
async function initTerminal() {
  // Wait for terminal font before rendering
  await document.fonts.load('400 14px "JetBrains Mono"');

  // Now safe to initialize xterm.js
  terminal.open(container);
}
```

---

## Implementation Recommendations

1. **Use @fontsource NPM packages** for JetBrains Mono + Source Code Pro
2. **@font-face with `font-display: swap`** to prevent FOIT (Flash of Invisible Text)
3. **Optional preload** for critical terminal font only (avoid over-preloading)
4. **FontFaceSet.ready** before terminal initialization to prevent layout shifts
5. **CSP: `font-src 'self'`** for security
6. **Avoid Fira Code** unless ligatures essential (adds complexity for xterm.js)

## Unresolved Questions

None - all critical areas covered for Electron terminal font implementation.
