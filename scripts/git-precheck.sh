#!/usr/bin/env bash
# git-precheck.sh — run at the start of every agent session
# Attempts to remove stale git lock files (older than 60 seconds) that WSL/Windows leaves behind,
# then verifies the working tree is on main and clean.
#
# Exit codes:
#   0 — all checks passed (locks may or may not have been removable)
#   1 — branch is not main
#
# Usage: bash scripts/git-precheck.sh [repo-root]

REPO_ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO_ROOT"

echo "[git-precheck] repo: $REPO_ROOT"

# ── 1. Remove stale lock files older than 60 seconds ───────────────────────
LOCK_REMOVED=0
LOCK_STUCK=0

try_remove_lock() {
  local LOCK_FILE="$1"
  if [ ! -f "$LOCK_FILE" ]; then
    return 0
  fi
  local FILE_MTIME
  FILE_MTIME=$(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)
  local FILE_AGE=$(( $(date +%s) - FILE_MTIME ))
  if [ "$FILE_AGE" -lt 60 ]; then
    echo "[git-precheck] WARNING: $LOCK_FILE is only ${FILE_AGE}s old — may be live, skipping"
    return 0
  fi
  if rm -f "$LOCK_FILE" 2>/dev/null; then
    echo "[git-precheck] removed stale lock: $LOCK_FILE (age ${FILE_AGE}s)"
    LOCK_REMOVED=$(( LOCK_REMOVED + 1 ))
  else
    echo "[git-precheck] WARNING: could not remove $LOCK_FILE (age ${FILE_AGE}s) — WSL/permission issue; git workaround (GIT_INDEX_FILE) still applies"
    LOCK_STUCK=$(( LOCK_STUCK + 1 ))
  fi
}

try_remove_lock ".git/index.lock"
try_remove_lock ".git/HEAD.lock"
try_remove_lock ".git/MERGE_HEAD.lock"
try_remove_lock ".git/CHERRY_PICK_HEAD.lock"

# .git/refs/heads/*.lock
while IFS= read -r LOCK_FILE; do
  try_remove_lock "$LOCK_FILE"
done < <(find .git/refs/heads -name "*.lock" 2>/dev/null)

if [ "$LOCK_REMOVED" -eq 0 ] && [ "$LOCK_STUCK" -eq 0 ]; then
  echo "[git-precheck] no stale locks found"
fi
if [ "$LOCK_STUCK" -gt 0 ]; then
  echo "[git-precheck] $LOCK_STUCK lock(s) could not be removed — use GIT_INDEX_FILE=/tmp/vanta_idx_$$ for git operations"
fi

# ── 2. Verify branch ────────────────────────────────────────────────────────
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$BRANCH" != "main" ]; then
  echo "[git-precheck] ERROR: expected branch main, got "$BRANCH""
  exit 1
fi
echo "[git-precheck] branch: $BRANCH OK"

# ── 3. Report working tree status ──────────────────────────────────────────
STATUS=$(GIT_INDEX_FILE=/tmp/vanta_precheck_idx git read-tree HEAD 2>/dev/null && GIT_INDEX_FILE=/tmp/vanta_precheck_idx git status --porcelain 2>/dev/null || git status --porcelain 2>/dev/null || echo "(git status failed)")
if [ -z "$STATUS" ]; then
  echo "[git-precheck] working tree: clean OK"
else
  echo "[git-precheck] WARNING: working tree has uncommitted changes:"
  echo "$STATUS"
fi

echo "[git-precheck] done"
