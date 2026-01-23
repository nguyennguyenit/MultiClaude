# Changelog

All notable changes to this project will be documented in this file.

## v1.1.7-beta.11 (2026-01-18)

### Improvements

- **Terminal:** Enhance buffer, scrollback, and view state persistence for improved session stability

## v1.1.7-beta.10 (2026-01-17)

### Improvements

- **Terminal:** Enhance buffer handling and scrollback management

## v1.1.7-beta.9 (2026-01-17)

### New Features

- **Workflow:** Add IPA Japan Standard documentation workflow for structured project documentation

### Improvements

- **Terminal:** Improve output handling and scrollback buffer for better CLI status line rendering

### Documentation

- Add IPA documentation suite (SRD, API, DB, UI specs)

## v1.1.7-beta.8 (2026-01-16)

### Documentation

- Update CHANGELOG for v1.1.7-beta.7

## v1.1.7-beta.7 (2026-01-16)

### Bug Fixes

- **Build:** Configure GitHub publish provider for auto-update manifest generation (`latest*.yml`)

## v1.1.7-beta.6 (2026-01-16)

### Bug Fixes

- **CI:** Generate auto-update manifest files (`latest*.yml`, `.blockmap`) in release workflow

## v1.1.7-beta.5 (2026-01-16)

### Bug Fixes

- **Release:** Prevent duplicate draft releases in workflow

### Tests

- Fix 5 failing E2E tests and update screenshots

## v1.1.7-beta.4 (2026-01-16)

### Bug Fixes

- **Terminal:** Implement single-parent pattern for stable project switching
- **Terminal:** Remove project switch delay workaround
- **Terminal:** Preserve scroll position on terminal switch within project
- **Terminal:** Fix cursor display on project switch
- **Terminal:** Prevent orphaned timers on multi-project switch
