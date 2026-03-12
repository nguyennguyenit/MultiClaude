#!/usr/bin/env bash
# parse-commits.sh - Parse conventional commits since last tag into categorized markdown
set -euo pipefail

# --- Defaults ---
FROM_TAG="" LIMIT=0

# --- Argument parsing ---
for arg in "$@"; do
  case "$arg" in
    --from-tag=*) FROM_TAG="${arg#*=}" ;;
    --from-tag)   shift; FROM_TAG="$1" ;;
    --limit=*)    LIMIT="${arg#*=}" ;;
    --limit)      shift; LIMIT="$1" ;;
    --help)       echo "Usage: parse-commits.sh [--from-tag <tag>] [--limit <n>]"; exit 0 ;;
  esac
done

# --- Find starting tag ---
if [[ -z "$FROM_TAG" ]]; then
  FROM_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
fi

# --- Get commits ---
if [[ -n "$FROM_TAG" ]]; then
  COMMITS=$(git log "${FROM_TAG}..HEAD" --oneline --no-merges 2>/dev/null || echo "")
else
  COMMITS=$(git log --oneline --no-merges -50 2>/dev/null || echo "")
fi

if [[ -z "$COMMITS" ]]; then
  echo "No commits found."
  exit 0
fi

# Apply limit
if [[ "$LIMIT" -gt 0 ]]; then
  COMMITS=$(echo "$COMMITS" | head -n "$LIMIT")
fi

# --- Category arrays (using temp files for portability) ---
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

touch "$TMPDIR/feat" "$TMPDIR/fix" "$TMPDIR/perf" "$TMPDIR/improvement" \
      "$TMPDIR/docs" "$TMPDIR/refactor" "$TMPDIR/breaking"

# --- Regex patterns (stored in vars for bash compatibility) ---
RE_BREAKING='^[a-z]+(\([^)]+\))?!:'
RE_BREAKING_KW='BREAKING[[:space:]]CHANGE'
RE_COMMIT='^([a-z]+)(\(([^)]+)\))?!?:[[:space:]]*(.+)$'

# --- Parse each commit ---
while IFS= read -r line; do
  HASH="${line%% *}"
  MSG="${line#* }"
  SHORT="${HASH:0:7}"

  # Check breaking change
  if [[ "$MSG" =~ $RE_BREAKING ]] || [[ "$MSG" =~ $RE_BREAKING_KW ]]; then
    if [[ "$MSG" =~ $RE_COMMIT ]]; then
      SCOPE="${BASH_REMATCH[3]}"
      BODY="${BASH_REMATCH[4]}"
      if [[ -n "$SCOPE" ]]; then
        echo "- **${SCOPE}:** ${BODY} (${SHORT})" >> "$TMPDIR/breaking"
      else
        echo "- ${BODY} (${SHORT})" >> "$TMPDIR/breaking"
      fi
    fi
    continue
  fi

  # Parse conventional commit: type(scope): message
  if [[ "$MSG" =~ $RE_COMMIT ]]; then
    TYPE="${BASH_REMATCH[1]}"
    SCOPE="${BASH_REMATCH[3]}"
    BODY="${BASH_REMATCH[4]}"

    # Skip ignored types
    case "$TYPE" in
      chore|ci|build|test|style) continue ;;
    esac

    # Map type to category file
    case "$TYPE" in
      feat)        CAT="feat" ;;
      fix)         CAT="fix" ;;
      perf)        CAT="perf" ;;
      improvement) CAT="improvement" ;;
      docs)        CAT="docs" ;;
      refactor)    CAT="refactor" ;;
      *)           CAT="improvement" ;;
    esac

    if [[ -n "$SCOPE" ]]; then
      echo "- **${SCOPE}:** ${BODY} (${SHORT})" >> "$TMPDIR/$CAT"
    else
      echo "- ${BODY} (${SHORT})" >> "$TMPDIR/$CAT"
    fi
  fi
done <<< "$COMMITS"

# --- Output markdown ---
OUTPUT=""
print_section() {
  local file="$1" title="$2"
  if [[ -s "$TMPDIR/$file" ]]; then
    OUTPUT+="## ${title}\n$(cat "$TMPDIR/$file")\n\n"
  fi
}

print_section "breaking"    "⚠ Breaking Changes"
print_section "feat"        "New Features"
print_section "fix"         "Bug Fixes"
print_section "perf"        "Performance"
print_section "improvement" "Improvements"
print_section "refactor"    "Refactoring"
print_section "docs"        "Documentation"

if [[ -z "$OUTPUT" ]]; then
  echo "No categorizable commits found."
else
  echo -e "$OUTPUT"
fi
