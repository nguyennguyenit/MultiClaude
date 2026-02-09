# Phase 4: Test & Verify Release Process

**Status:** done (2026-01-03)
**Effort:** 30m

## Objective

Verify the complete release pipeline works end-to-end.

## Tasks

### 4.1 Local build test

```bash
# Test build locally first
npm run build:unpack

# Verify output
ls -la release/linux-unpacked/  # Linux
ls -la release/mac/             # macOS
ls -la release/win-unpacked/    # Windows
```

### 4.2 Test release with dry-run

```bash
# Build but don't publish
npm run build
```

### 4.3 Create test release

```bash
# Bump to test version
npm version patch

# Push with tag
git push origin master --tags
```

### 4.4 Verify GitHub Actions

1. Go to: https://github.com/nguyennguyenit/MultiClaude/actions
2. Check Release workflow triggered
3. Wait for all 3 jobs to complete (~10-15 min)
4. Check for any errors in logs

### 4.5 Verify GitHub Releases

1. Go to: https://github.com/nguyennguyenit/MultiClaude/releases
2. Check release created with correct version
3. Verify artifacts:
   - Linux: `.AppImage`, `.deb`
   - macOS: `.dmg`, `.zip`
   - Windows: `.exe` (NSIS installer)
4. Check `latest.yml`, `latest-mac.yml` files exist (for auto-update)

### 4.6 Test auto-update (optional)

1. Install an older version locally
2. Create a new release
3. Start the app
4. Verify update prompt appears

## Verification Checklist

- [ ] Local `npm run build` succeeds
- [ ] Tag push triggers GitHub Actions
- [ ] All 3 platform builds succeed
- [ ] Release created with all artifacts
- [ ] `latest*.yml` files present for auto-update
- [ ] App starts correctly from built installer
- [ ] Auto-update detects new version

## Troubleshooting

### Build fails on GitHub Actions

1. Check workflow logs for specific error
2. Common issues:
   - Missing native dependencies → add to workflow
   - Permission issues → check GH_TOKEN
   - Out of memory → use larger runner

### Auto-update doesn't work

1. Check `latest.yml` exists in release
2. Verify app version < release version
3. Check console logs for update errors
4. macOS: unsigned apps may fail silently

### Artifacts missing

1. Check build output in workflow logs
2. Verify `release/` directory structure
3. Check electron-builder config targets

## Post-Release

### Update README.md

Add download section:

```markdown
## Download

Get the latest version from [GitHub Releases](https://github.com/nguyennguyenit/MultiClaude/releases).

| Platform | Download |
|----------|----------|
| Linux | `.AppImage` or `.deb` |
| macOS | `.dmg` |
| Windows | `.exe` installer |

### First Run Notes

- **macOS**: Right-click the app → Open → Open (to bypass Gatekeeper)
- **Windows**: Click "More info" → "Run anyway" (for SmartScreen warning)
```
