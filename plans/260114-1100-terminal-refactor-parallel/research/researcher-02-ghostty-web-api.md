# ghostty-web API Research

**Package:** ghostty-web@0.4.0
**Repo:** github.com/coder/ghostty-web
**Bundle Size:** ~400KB WASM
**License:** MIT

## Executive Summary

ghostty-web claims xterm.js API compatibility via drop-in import replacement. Uses Ghostty native WASM parser instead of JS reimplementation. Active development, created for Coder's Mux desktop app.

## API Compatibility Matrix

| Feature | xterm.js | ghostty-web | Notes |
|---------|----------|-------------|-------|
| Core Terminal API | ✓ | ✓ | Drop-in compatible |
| `Terminal` constructor | ✓ | ✓ | Accepts same options |
| `.open(element)` | ✓ | ✓ | Mount to DOM |
| `.write(data)` | ✓ | ✓ | Write output |
| `.onData(callback)` | ✓ | ✓ | Handle input |
| `.resize(cols, rows)` | ✓ | **?** | Not documented |
| `.fit()` | ✓ (addon) | **?** | Not documented |
| Addons (web-links) | ✓ | **?** | Not documented |
| Complex scripts | ⚠️ Issues | ✓ | Better Unicode |
| XTPUSHSGR/XTPOPSGR | ✗ | ✓ | SGR save/restore |

## Migration Code Example

```javascript
// Before (xterm.js)
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

const term = new Terminal({ fontSize: 14 });
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(element);
fitAddon.fit();

// After (ghostty-web)
import { init, Terminal } from 'ghostty-web';

await init(); // REQUIRED: WASM initialization
const term = new Terminal({ fontSize: 14 });
term.open(element);
// resize/fit API unknown - needs investigation
```

## Key Differences

### Initialization
**ghostty-web requires async WASM init:**
```javascript
await init(); // Must call before Terminal creation
```

### Theme/Options
```javascript
new Terminal({
  fontSize: 14,
  theme: {
    background: '#1a1b26',
    foreground: '#a9b1d6',
  },
});
```

## Missing Documentation

**Critical gaps (requires code inspection or testing):**

1. **Resize API** - no `.resize(cols, rows)` docs
2. **Fit functionality** - no FitAddon equivalent docs
3. **Addons system** - no mention of `.loadAddon()`
4. **Web-links support** - link detection addon unknown
5. **TypeScript definitions** - API surface not accessible from GitHub
6. **Disposal** - `.dispose()` method not documented
7. **Event APIs** - `.onResize()`, `.onTitleChange()`, etc. unknown

## Advantages Over xterm.js

1. **Native parser** - battle-tested Ghostty C code via WASM
2. **Better Unicode** - proper grapheme/complex script rendering
3. **VT100 completeness** - XTPUSHSGR/XTPOPSGR support
4. **Zero dependencies** - self-contained WASM bundle

## Known Limitations

1. **WASM overhead** - 400KB bundle (xterm.js ~200KB)
2. **Async init required** - adds initialization step
3. **Active development** - v0.4.0, API may change
4. **Custom patches** - currently uses patched Ghostty source
5. **Documentation gaps** - many APIs undocumented
6. **No TypeScript exports visible** - type definitions not in public repo

## Migration Effort Assessment

**Risk Level:** **MEDIUM-HIGH**

### Blockers
- **Resize/fit API unknown** - critical for current codebase
- **Web-links addon unknown** - feature parity unclear
- **TypeScript types unavailable** - no API contract verification

### Effort Estimate
- **If API complete:** 2-4 hours (simple import swap + init)
- **If resize/fit missing:** 8-16 hours (custom implementation)
- **If addon system different:** 16-24 hours (refactor addon usage)

### Recommended Next Steps

1. **Install locally** - `npm install ghostty-web@0.4.0`
2. **Inspect types** - check `node_modules/ghostty-web/dist/*.d.ts`
3. **Test resize** - verify `.resize()` method exists
4. **Test fit** - check if FitAddon compatible or built-in
5. **Test web-links** - verify link detection capability

## Unresolved Questions

1. Does ghostty-web export FitAddon or have built-in fit()?
2. Is addon system compatible with xterm.js addons?
3. Are TypeScript definitions complete for all xterm.js APIs?
4. Does .resize(cols, rows) method exist?
5. How does disposal/cleanup work?
6. Are event handlers (.onResize, .onTitleChange) supported?
7. What's the performance comparison vs xterm.js?
8. Does it work in all modern browsers (Safari, Firefox)?
