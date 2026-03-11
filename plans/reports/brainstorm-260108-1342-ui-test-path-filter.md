# UI Test Path-based Filtering

## Problem Statement
UI tests chạy mỗi khi push lên main/beta, gây tốn resources khi thay đổi không liên quan đến UI (backend, types, configs).

## Requirements
- UI test chỉ trigger khi có thay đổi liên quan đến giao diện
- Không cần can thiệp manual từ developer
- Vẫn cover đủ các case cần test

## Evaluated Approaches

### 1. Path-based filtering ✅ SELECTED
**Pros**: Tự động, không cần thao tác thêm, reliable
**Cons**: Cần cấu hình đúng paths

### 2. Commit message pattern
**Pros**: Developer kiểm soát linh hoạt
**Cons**: Dễ quên tag, không consistent

### 3. PR labels
**Pros**: Explicit control
**Cons**: Cần thao tác manual mỗi PR

### 4. Workflow dispatch only
**Pros**: Full control
**Cons**: Mất tự động hóa

## Final Solution

Add `paths` filter to `.github/workflows/ui-tests.yml`:

```yaml
on:
  push:
    branches: [main, beta]
    paths:
      - 'src/renderer/**'
      - 'src/**/*.tsx'
      - 'src/**/*.css'
      - 'src/__tests__/e2e/**'
      - 'index.html'
  pull_request:
    branches: [main, beta]
    paths:
      - 'src/renderer/**'
      - 'src/**/*.tsx'
      - 'src/**/*.css'
      - 'src/__tests__/e2e/**'
      - 'index.html'
```

## Paths Rationale
| Path | Reason |
|------|--------|
| `src/renderer/**` | All frontend code |
| `src/**/*.tsx` | React components anywhere |
| `src/**/*.css` | Style changes |
| `src/__tests__/e2e/**` | Test files/snapshots updates |
| `index.html` | HTML structure changes |

## Implementation
Single file edit: `.github/workflows/ui-tests.yml`

## Success Metrics
- UI test không chạy khi chỉ thay đổi backend code
- UI test chạy khi thay đổi bất kỳ component nào
- Giảm thời gian CI trung bình

## Risks
- Nếu paths định nghĩa thiếu, có thể miss UI regressions
- Mitigation: Include `**/*.tsx` để cover broad
