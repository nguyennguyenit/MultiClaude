# Verification Test Plan: Cursor Blink Bug

## Quick Verification (5 minutes)

### Method 1: Console Log Tracing

**Add logging to terminal-view.tsx:**

```typescript
// src/renderer/components/terminal/terminal-view.tsx:76-82
useEffect(() => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`[Terminal ${terminalId}]`)
  console.log(`  isActive: ${isActive}`)
  console.log(`  Current activeTerminalId: ${useAppStore.getState().activeTerminalId}`)

  if (isActive) {
    console.log(`  ✓ CALLING focus() - cursor should blink`)
    focus()
    fit()
  } else {
    console.log(`  ✗ NOT calling focus() - cursor will NOT blink properly`)
  }
}, [isActive, focus, fit])
```

**Test Steps:**
1. Start app with Project A (3 terminals)
2. Open DevTools Console (F12)
3. Switch to Project B (2 terminals)
4. Observe console output

**Expected Output (BUG):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Terminal term-b-1]
  isActive: false
  Current activeTerminalId: term-a-1
  ✗ NOT calling focus() - cursor will NOT blink properly
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Terminal term-b-2]
  isActive: false
  Current activeTerminalId: term-a-1
  ✗ NOT calling focus() - cursor will NOT blink properly
```

**Proof**: NO terminals get focused → cursor blink broken

---

### Method 2: State Inspector

**Add to App.tsx after handleSelectProject:**

```typescript
// src/renderer/App.tsx after line 108
console.log(`[Project Switch Debug]`)
console.log(`  Previous Project: ${prevProjectIdRef.current}`)
console.log(`  New Project: ${id}`)
console.log(`  activeTerminalId BEFORE: ${activeTerminalId}`)
console.log(`  New project terminals:`, projectTerminals.map(t => t.id))
console.log(`  Match found: ${projectTerminals.some(t => t.id === activeTerminalId)}`)
```

**Expected Output (BUG):**
```
[Project Switch Debug]
  Previous Project: project-a
  New Project: project-b
  activeTerminalId BEFORE: term-a-1
  New project terminals: ['term-b-1', 'term-b-2']
  Match found: false  ← PROOF: No terminal matches
```

---

## Detailed Verification Test

### Test Case 1: Project Switch with Active Terminal

**Setup:**
- Project A: 3 terminals (term-a-1, term-a-2, term-a-3)
- Project B: 2 terminals (term-b-1, term-b-2)
- activeTerminalId = "term-a-1"

**Steps:**
1. Start app, load Project A
2. Verify cursor blinks in term-a-1
3. Switch to Project B
4. Observe ALL terminals in Project B

**Expected (BUG):**
- ✗ Cursor in term-b-1: NOT blinking or blinking incorrectly
- ✗ Cursor in term-b-2: NOT blinking or blinking incorrectly
- ✗ Console shows: Both terminals have isActive={false}

**Expected After Fix:**
- ✓ Cursor in term-b-1: Blinking correctly (auto-selected)
- ✓ term-b-2: Cursor not focused (expected)
- ✓ Console shows: term-b-1 has isActive={true}

---

### Test Case 2: Rapid Project Switching

**Setup:**
- Project A: 2 terminals
- Project B: 3 terminals
- Project C: 1 terminal

**Steps:**
1. Switch A → B → C → A (rapid)
2. Observe cursor behavior in each project

**Expected (BUG):**
- ✗ Each switch leaves all terminals with broken cursor
- ✗ activeTerminalId gets increasingly stale

**Expected After Fix:**
- ✓ Each switch auto-selects first terminal
- ✓ Cursor always works correctly

---

### Test Case 3: Empty Project Switch

**Setup:**
- Project A: 2 terminals
- Project B: 0 terminals (empty)

**Steps:**
1. Switch from A to B (empty project)
2. Check activeTerminalId

**Expected (BUG):**
- ✗ activeTerminalId still references term-a-1
- ✗ Stale state persists

**Expected After Fix:**
- ✓ activeTerminalId = null (no terminals to select)
- ✓ Clean state

---

## Automated Test (Playwright)

### Test File: `cursor-blink-project-switch.spec.ts`

```typescript
import { test, expect } from '@playwright/test'
import { MultiClaudeTestHelper } from './helpers/test-helper'

test.describe('Cursor Blink on Project Switch', () => {
  let helper: MultiClaudeTestHelper

  test.beforeEach(async ({ page }) => {
    helper = new MultiClaudeTestHelper(page)
    await helper.launch()
  })

  test('should focus first terminal when switching projects', async ({ page }) => {
    // Setup: Create Project A with 2 terminals
    await helper.createProject('ProjectA', '/tmp/project-a')
    await helper.createTerminal()
    await helper.createTerminal()
    const termA1 = await helper.getActiveTerminalId()

    // Setup: Create Project B with 2 terminals
    await helper.createProject('ProjectB', '/tmp/project-b')
    await helper.createTerminal()
    await helper.createTerminal()

    // Switch back to Project A
    await helper.selectProject('ProjectA')
    expect(await helper.getActiveTerminalId()).toBe(termA1)

    // TEST: Switch to Project B
    await helper.selectProject('ProjectB')

    // Verify: activeTerminalId should be first terminal of Project B
    const termB1 = await helper.getFirstTerminalId()
    expect(await helper.getActiveTerminalId()).toBe(termB1)

    // Verify: First terminal should have isActive=true
    const isActive = await page.evaluate((id) => {
      const terminals = document.querySelectorAll('.terminal-pane')
      const firstTerminal = terminals[0]
      return firstTerminal?.classList.contains('terminal-pane-active')
    }, termB1)
    expect(isActive).toBe(true)
  })

  test('should handle empty project switch', async ({ page }) => {
    // Setup: Project A with terminals
    await helper.createProject('ProjectA', '/tmp/project-a')
    await helper.createTerminal()

    // Setup: Project B empty
    await helper.createProject('ProjectB', '/tmp/project-b')

    // TEST: Switch to empty project
    await helper.selectProject('ProjectB')

    // Verify: activeTerminalId should be null
    expect(await helper.getActiveTerminalId()).toBeNull()
  })

  test('cursor should blink after project switch', async ({ page }) => {
    // Setup two projects with terminals
    await helper.createProject('ProjectA', '/tmp/project-a')
    await helper.createTerminal()

    await helper.createProject('ProjectB', '/tmp/project-b')
    await helper.createTerminal()

    // Switch to Project B
    await helper.selectProject('ProjectB')

    // Wait for terminal to initialize
    await page.waitForTimeout(500)

    // Check if cursor element exists and is visible
    const cursorVisible = await page.evaluate(() => {
      const terminal = document.querySelector('.terminal-container .xterm-cursor-layer')
      return terminal !== null && getComputedStyle(terminal).display !== 'none'
    })

    expect(cursorVisible).toBe(true)
  })
})
```

---

## Manual Visual Test

### Visual Indicators to Check:

1. **Cursor Blinking Animation**
   - Should see cursor blink on/off every ~500ms
   - Use browser DevTools → Animations to inspect

2. **Terminal Focus Ring**
   - Active terminal should have visual border/highlight
   - Check CSS class: `.terminal-pane-active`

3. **DevTools Elements Inspector**
   ```
   .terminal-container
   └── .xterm
       └── .xterm-cursor-layer
           └── .xterm-cursor-block (should toggle opacity)
   ```

4. **Watch xterm.js Internal State**
   ```javascript
   // In browser console
   const terminals = document.querySelectorAll('.xterm')
   terminals.forEach((term, i) => {
     console.log(`Terminal ${i}:`, {
       hasFocus: term._core?.textarea === document.activeElement,
       cursorBlink: term._core?.options?.cursorBlink,
       cursorState: term._core?.viewport?._renderService?.cursorState
     })
   })
   ```

---

## Regression Test After Fix

### Verify Fix with Console Logs:

**Expected Output After Fix (Solution 2):**
```
[Project Switch Debug]
  Previous Project: project-a
  New Project: project-b
  activeTerminalId BEFORE: term-a-1
  activeTerminalId AFTER: term-b-1  ← FIXED: Auto-selected first terminal
  New project terminals: ['term-b-1', 'term-b-2']
  Match found: true  ← FIXED: Match found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Terminal term-b-1]
  isActive: true  ← FIXED
  Current activeTerminalId: term-b-1
  ✓ CALLING focus() - cursor should blink  ← FIXED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Terminal term-b-2]
  isActive: false
  Current activeTerminalId: term-b-1
  ✗ NOT calling focus() - cursor will NOT blink properly
```

**Proof of Fix**: First terminal IS focused, cursor blinks correctly

---

## Performance Test

### Measure Focus Timing:

```typescript
// Add to terminal-view.tsx
useEffect(() => {
  const startTime = performance.now()
  if (isActive) {
    focus()
    const endTime = performance.now()
    console.log(`[Terminal ${terminalId}] Focus took ${endTime - startTime}ms`)
  }
}, [isActive, focus])
```

**Expected Timing:**
- Focus should complete in <5ms
- No performance impact from fix

---

## Summary Checklist

- [ ] Console logs show correct activeTerminalId after switch
- [ ] First terminal of new project has isActive={true}
- [ ] focus() is called for first terminal
- [ ] Cursor blinks visually in first terminal
- [ ] Other terminals do NOT interfere with cursor
- [ ] Rapid switching works without corruption
- [ ] Empty project switch sets activeTerminalId=null
- [ ] No performance degradation
- [ ] No visual glitches during transition

**All checks must pass to confirm fix is complete.**
