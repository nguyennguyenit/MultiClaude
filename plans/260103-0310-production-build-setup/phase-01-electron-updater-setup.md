# Phase 1: Install & Configure electron-updater

**Status:** done (2026-01-03)
**Effort:** 30m

## Objective

Add electron-updater dependency and configure electron-builder for auto-update support.

## Tasks

### 1.1 Install electron-updater

```bash
npm install electron-updater
```

### 1.2 Update package.json build config

Add `publish` config to enable GitHub Releases integration:

```json
{
  "build": {
    "appId": "com.multiclaude.app",
    "productName": "MultiClaude",
    "publish": {
      "provider": "github",
      "owner": "nguyennguyenit",
      "repo": "MultiClaude"
    },
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*"
    ],
    "linux": {
      "target": [
        "AppImage",
        "deb"
      ],
      "category": "Development"
    },
    "mac": {
      "target": [
        "dmg",
        "zip"
      ]
    },
    "win": {
      "target": [
        "nsis",
        "portable"
      ]
    }
  }
}
```

### 1.3 Add npm scripts for release

```json
{
  "scripts": {
    "release": "npm run build && electron-builder --publish always",
    "release:linux": "npm run build && electron-builder --linux --publish always",
    "release:win": "npm run build && electron-builder --win --publish always",
    "release:mac": "npm run build && electron-builder --mac --publish always"
  }
}
```

## Verification

- [ ] `npm ls electron-updater` shows package installed
- [ ] `npm run build:unpack` completes without errors
- [ ] `release/` folder contains unpacked app

## Notes

- `publish: always` means artifacts are published to GitHub Releases
- For local testing, use `publish: never` or `--publish never` flag
- `provider: github` auto-detects from package.json repository field
