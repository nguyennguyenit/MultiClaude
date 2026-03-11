# Release Readiness Brainstorm Report

**Date:** 2026-01-01
**Topic:** MultiClaude release preparation for public distribution

## Problem Statement

User wants to ship MultiClaude as a public release on Windows, Linux, and macOS but currently lacks:
- Code signing certificates
- Test coverage
- Clean git history (uncommitted changes)

## Current State Analysis

### What's Ready
- Build system (Electron Builder) configured for all 3 platforms
- TypeScript compiles without errors
- AppImage already built successfully (111MB)
- Basic README documentation

### What's Missing

| Category | Items |
|----------|-------|
| Code Hygiene | 8 modified files uncommitted, many untracked files |
| Testing | Zero test files in project |
| Signing | No Apple Developer or Windows signing certificates |
| CI/CD | No automated build pipeline |
| Polish | Default app icon, no auto-update |

## Evaluated Approaches

### Approach 1: Ship Unsigned (Fast)
**Pros:** Immediate release, no cost
**Cons:** Windows SmartScreen + macOS Gatekeeper warnings, looks like malware

### Approach 2: Linux First (Pragmatic)
**Pros:** No signing needed, fastest to ship
**Cons:** Limited audience, delays Win/Mac

### Approach 3: Full Signing (Professional)
**Pros:** No security warnings, professional appearance
**Cons:** $300-500/year cost, 1-5 days setup time

## Recommended Solution

**Phased rollout with Linux first, followed by signed Windows/macOS releases.**

### Phase 1: Code Cleanup (Current Priority)
1. Add `new-feature/` and `repomix-output.xml` to `.gitignore`
2. Review and commit all modified files
3. Setup Vitest testing framework
4. Write unit tests for core modules
5. Clean commit history

### Phase 2: Linux Release
- Polish AppImage build
- Test on multiple distros
- Release on GitHub Releases

### Phase 3: Windows Release
- Acquire code signing certificate ($200-400)
- Configure electron-builder for signed builds
- Test installer flow

### Phase 4: macOS Release
- Register Apple Developer ($99/year)
- Configure notarization
- Test on multiple macOS versions

### Phase 5: Automation
- GitHub Actions CI/CD
- Auto-update with electron-updater
- Semantic versioning

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Distribution target | Public release | User's goal |
| Signing certificates | Will acquire later | Cost barrier, start with Linux |
| Platform priority | All platforms | User preference |
| First action | Phase 1 Cleanup | Foundation before release |
| Testing | Add now | Quality requirement for public release |
| `new-feature/` folder | Add to .gitignore | Local planning folder, not for repo |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Users won't bypass security warnings | Clear installation instructions, video tutorials |
| Certificate cost | Start with Linux, validate product-market fit first |
| No tests = regressions | Add tests before major changes |
| node-pty native module issues | Test on clean OS installations |

## Success Metrics

- [ ] All code committed with clean history
- [ ] >70% test coverage on core modules
- [ ] Successful builds on all 3 platforms
- [ ] Zero TypeScript errors
- [ ] GitHub release with download counts

## Next Steps

1. Create detailed implementation plan for Phase 1
2. Execute cleanup tasks
3. Setup testing framework
4. Write initial test suite

## Unresolved Questions

1. Which testing framework to use? (Vitest recommended for Vite projects)
2. Specific modules to prioritize for testing?
3. Timeline for acquiring signing certificates?
