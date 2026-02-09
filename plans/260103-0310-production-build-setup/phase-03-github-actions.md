# Phase 3: Create GitHub Actions Workflow

**Status:** done
**Effort:** 1h
**Completed:** 2026-01-03

## Objective

Create CI/CD workflow to automatically build and publish releases when a version tag is pushed.

## Tasks

### 3.1 Create workflow file

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build and Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run release

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: |
            release/*.AppImage
            release/*.deb
            release/*.dmg
            release/*.zip
            release/*.exe
          if-no-files-found: ignore
```

### 3.2 Create GitHub repository secret

No manual secret needed - `GITHUB_TOKEN` is automatically provided by GitHub Actions.

### 3.3 Update package.json version script (optional)

Add version bump scripts:

```json
{
  "scripts": {
    "version:patch": "npm version patch",
    "version:minor": "npm version minor",
    "version:major": "npm version major"
  }
}
```

## Release Process

1. **Bump version:**
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   # or
   npm version minor  # 1.0.0 -> 1.1.0
   ```

2. **Push with tags:**
   ```bash
   git push origin master --tags
   ```

3. **Monitor build:**
   - Go to GitHub → Actions tab
   - Watch the Release workflow run

4. **Verify release:**
   - Go to GitHub → Releases
   - Check all platform artifacts are uploaded

## Verification

- [ ] `.github/workflows/release.yml` created
- [ ] Workflow syntax valid (check in GitHub Actions tab)
- [ ] Test with `v1.0.1` tag push
- [ ] All 3 platform builds succeed
- [ ] Artifacts appear in GitHub Releases

## Notes

- `npm ci` is faster and more reliable than `npm install` in CI
- `GITHUB_TOKEN` has write access to releases by default
- Each OS runner builds only its native platform
- Artifacts are uploaded for debugging if release fails
- `if-no-files-found: ignore` prevents errors when some files don't exist on a platform
