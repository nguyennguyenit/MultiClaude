#!/usr/bin/env bash
# release.sh - Core release script: validate, bump version, commit, tag, push
# Exit codes: 0=success, 1=validation error, 2=tag exists, 3=npm version failed, 4=git failed, 10=bump conflict
# Multi-project compatible — no hardcoded branch names
set -euo pipefail

# --- Defaults ---
TYPE="" DRY_RUN=false SKIP_PUSH=false CUSTOM_VERSION="" VERBOSE=false BUMP_TYPE=""
NEW_VERSION="" PREV_HEAD=""

# --- Usage ---
usage() {
  cat <<EOF
Usage: release.sh --type=<beta|stable> [options]
Options:
  --type=beta|stable   Release type (required)
  --dry-run            Preview only, no changes
  --skip-push          Local only, no remote push
  --version=<semver>   Custom version (stable only)
  --bump=patch|minor|major  Resolve version conflict (beta only)
  --verbose            Debug output
  --help               Show this help
EOF
  exit 0
}

# --- Argument parsing ---
for arg in "$@"; do
  case "$arg" in
    --type=*)      TYPE="${arg#*=}" ;;
    --dry-run)     DRY_RUN=true ;;
    --skip-push)   SKIP_PUSH=true ;;
    --version=*)   CUSTOM_VERSION="${arg#*=}" ;;
    --bump=*)      BUMP_TYPE="${arg#*=}" ;;
    --verbose)     VERBOSE=true ;;
    --help)        usage ;;
    *)             echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

log() { $VERBOSE && echo "[DEBUG] $*" || true; }

# --- Detect default branch (combo fallback) ---
get_default_branch() {
  local branch
  # 1. git remote HEAD (most reliable, no network)
  branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|.*/||')
  # 2. Fallback: gh API
  if [[ -z "$branch" ]] && command -v gh &>/dev/null; then
    branch=$(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name' 2>/dev/null)
  fi
  # 3. Last resort: guess from existing branches
  if [[ -z "$branch" ]]; then
    for candidate in main master; do
      if git show-ref --verify --quiet "refs/heads/$candidate" 2>/dev/null; then
        branch="$candidate"
        break
      fi
    done
  fi
  echo "${branch:-main}"
}

# --- Semver compare: returns 0 if $1 <= $2 ---
version_lte() {
  [[ "$(printf '%s\n%s' "$1" "$2" | sort -V | head -1)" == "$1" ]]
}

# --- Validate type ---
[[ -z "$TYPE" ]] && { echo "Error: --type is required (beta|stable)"; exit 1; }
[[ "$TYPE" != "beta" && "$TYPE" != "stable" ]] && { echo "Error: --type must be beta or stable"; exit 1; }

# --- Validate clean working tree ---
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree is not clean."
  git status --short
  exit 1
fi

# --- Current branch (no hardcoded validation — any branch allowed) ---
BRANCH=$(git branch --show-current)
log "Current branch: $BRANCH"

# --- Version sync check: compare package.json vs latest git tag ---
CURRENT=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
if [[ -z "$CURRENT" ]]; then
  echo "Error: Cannot read version from package.json"
  exit 1
fi
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -n "$LATEST_TAG" ]]; then
  TAG_VERSION="${LATEST_TAG#v}"
  if [[ "$CURRENT" != "$TAG_VERSION" ]]; then
    echo "⚠ Version mismatch: package.json=$CURRENT, latest tag=$LATEST_TAG"
    echo "  Run: npm version $TAG_VERSION --no-git-tag-version"
    echo "  Then commit and retry."
    exit 1
  fi
fi
log "Current version: $CURRENT"

# --- Auth pre-check (HTTPS remotes) ---
if ! $DRY_RUN && ! $SKIP_PUSH; then
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
  if [[ "$REMOTE_URL" == https://* ]]; then
    # Setup gh auth for HTTPS if available
    if command -v gh &>/dev/null; then
      gh auth setup-git 2>/dev/null || true
    fi
    # Verify push access
    if ! git push --dry-run origin "$BRANCH" &>/dev/null; then
      echo "Error: Cannot push to origin. Check git credentials."
      echo "  Try: gh auth setup-git"
      exit 4
    fi
  fi
fi

# --- Calculate new version ---
if [[ "$TYPE" == "beta" ]]; then
  # Get latest stable tag merged into default branch
  DEFAULT_BRANCH=$(get_default_branch)
  LATEST_STABLE_TAG=$(git tag -l 'v*' --sort=-v:refname --merged="$DEFAULT_BRANCH" 2>/dev/null | grep -v -E 'beta|alpha|rc' | head -1)
  LATEST_STABLE="${LATEST_STABLE_TAG#v}"
  log "Default branch: $DEFAULT_BRANCH, Latest stable: $LATEST_STABLE"

  # Extract base version from current (strip -beta.X if present)
  if [[ "$CURRENT" =~ -beta\.([0-9]+)$ ]]; then
    BETA_BASE="${CURRENT%-beta.*}"
  else
    BETA_BASE="$CURRENT"
  fi

  # Compare beta base vs latest stable
  if [[ -n "$LATEST_STABLE" ]] && version_lte "$BETA_BASE" "$LATEST_STABLE"; then
    # Conflict: beta base <= stable
    if [[ -n "$BUMP_TYPE" ]]; then
      # Resolve conflict inline with --bump flag
      IFS='.' read -r MAJOR MINOR PATCH <<< "$LATEST_STABLE"
      case "$BUMP_TYPE" in
        patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))-beta.1" ;;
        minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0-beta.1" ;;
        major) NEW_VERSION="$((MAJOR + 1)).0.0-beta.1" ;;
        *) echo "Error: --bump must be patch|minor|major"; exit 1 ;;
      esac
    else
      echo "BUMP_CONFLICT|${LATEST_STABLE}|${BETA_BASE}"
      exit 10
    fi
  else
    # No conflict: beta already ahead of stable
    if [[ "$CURRENT" =~ -beta\.([0-9]+)$ ]]; then
      BETA_NUM="${BASH_REMATCH[1]}"
      NEW_VERSION="${BETA_BASE}-beta.$((BETA_NUM + 1))"
    else
      IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
      NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))-beta.1"
    fi
  fi
elif [[ "$TYPE" == "stable" ]]; then
  if [[ -n "$CUSTOM_VERSION" ]]; then
    NEW_VERSION="$CUSTOM_VERSION"
  elif [[ "$CURRENT" =~ -beta ]]; then
    NEW_VERSION="${CURRENT%-beta.*}"
  else
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
  fi
fi
log "New version: $NEW_VERSION"

# --- Check tag doesn't exist ---
if git rev-parse "v${NEW_VERSION}" >/dev/null 2>&1; then
  echo "Error: Tag v${NEW_VERSION} already exists"
  echo "  Existing tag: $(git log -1 --format='%h %s' "v${NEW_VERSION}" 2>/dev/null || echo 'unknown')"
  exit 2
fi

# --- Dry run output ---
REPO_URL=$(git remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|')
echo ""
echo "=== Release Preview ==="
echo "  Type:     $TYPE"
echo "  Current:  v$CURRENT"
echo "  New:      v$NEW_VERSION"
echo "  Branch:   $BRANCH"
echo "  Push:     $( $SKIP_PUSH && echo 'no' || echo 'yes' )"
echo "======================="
echo ""

if $DRY_RUN; then
  echo "[DRY RUN] No changes made."
  exit 0
fi

# --- Rollback on failure ---
PREV_HEAD=$(git rev-parse HEAD)
cleanup() {
  echo "Error occurred, rolling back..."
  git tag -d "v${NEW_VERSION}" 2>/dev/null || true
  git reset --hard "$PREV_HEAD" 2>/dev/null || true
  echo "Rollback complete."
  exit 4
}
trap cleanup ERR

# --- Bump version ---
npm version "$NEW_VERSION" --no-git-tag-version || { echo "Error: npm version failed"; exit 3; }

# --- Stage and commit ---
LOCKFILE=""
[[ -f "package-lock.json" ]] && LOCKFILE="package-lock.json"
[[ -f "yarn.lock" ]] && LOCKFILE="yarn.lock"
[[ -f "pnpm-lock.yaml" ]] && LOCKFILE="pnpm-lock.yaml"

git add package.json ${LOCKFILE:+"$LOCKFILE"}
git commit -m "chore(release): v${NEW_VERSION}"

# --- Tag ---
git tag "v${NEW_VERSION}"

# --- Push ---
if ! $SKIP_PUSH; then
  git push origin "$BRANCH" --tags || { echo "Error: Push failed. Tag and commit remain local."; exit 4; }
fi

echo ""
echo "✔ Released v${NEW_VERSION} successfully!"
[[ "$SKIP_PUSH" == "true" ]] && echo "  (local only — push manually with: git push origin $BRANCH --tags)"

# --- Post-release: show CI status if workflows exist ---
if ! $SKIP_PUSH && command -v gh &>/dev/null; then
  WORKFLOW_COUNT=$(gh workflow list --json name 2>/dev/null | grep -c '"name"' || echo "0")
  if [[ "$WORKFLOW_COUNT" -gt 0 ]]; then
    echo ""
    echo "--- CI/CD Status ---"
    gh run list --limit 2 --json status,name,conclusion,url 2>/dev/null | \
      sed 's/\[//;s/\]//;s/},{/\n/g' | head -5 || true
  fi
fi
