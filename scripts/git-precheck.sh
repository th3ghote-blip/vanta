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
  if rm -f "$LOCK_FILE" 2>/dev/null && [ ! -f "$LOCK_FILE" ]; then
    echo "[git-precheck] removed stale lock: $LOCK_FILE (age ${FILE_AGE}s)"
    LOCK_REMOVED=$(( LOCK_REMOVED + 1 ))
  # On the Windows/WSL mount, unlink (rm) fails with "Operation not permitted"
  # but RENAME (mv) succeeds. Move the lock aside so git can re-create it.
  # This is what actually unblocks a stuck index.lock / HEAD.lock / ref.lock --
  # GIT_INDEX_FILE only helps the index, not the HEAD/ref locks needed to commit.
  elif mv -f "$LOCK_FILE" "${LOCK_FILE}.stale.$(date +%s%N)" 2>/dev/null && [ ! -f "$LOCK_FILE" ]; then
    echo "[git-precheck] renamed stale lock aside (rm not permitted on this mount): $LOCK_FILE (age ${FILE_AGE}s)"
    LOCK_REMOVED=$(( LOCK_REMOVED + 1 ))
  else
    echo "[git-precheck] WARNING: could not clear $LOCK_FILE (age ${FILE_AGE}s) -- neither rm nor mv worked"
    LOCK_STUCK=$(( LOCK_STUCK + 1 ))
  fi
}

# Order matters: HEAD/ref locks block commits, index.lock blocks add/reset.
try_remove_lock ".git/index.lock"
try_remove_lock ".git/HEAD.lock"
try_remove_lock ".git/ORIG_HEAD.lock"
try_remove_lock ".git/MERGE_HEAD.lock"
try_remove_lock ".git/CHERRY_PICK_HEAD.lock"
try_remove_lock ".git/objects/maintenance.lock"

# every other *.lock anywhere under .git (refs/heads, refs/remotes, packed-refs,
# etc.), skipping the .stale.* files we just renamed aside
while IFS= read -r LOCK_FILE; do
  case "$LOCK_FILE" in *.stale.*) continue ;; esac
  try_remove_lock "$LOCK_FILE"
done < <(find .git -name "*.lock" 2>/dev/null)

if [ "$LOCK_REMOVED" -eq 0 ] && [ "$LOCK_STUCK" -eq 0 ]; then
  echo "[git-precheck] no stale locks found"
fi
if [ "$LOCK_STUCK" -gt 0 ]; then
  echo "[git-precheck] $LOCK_STUCK lock(s) could not be cleared -- manual intervention needed"
fi

# ── 2. Verify branch ────────────────────────────────────────────────────────
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$BRANCH" != "main" ]; then
  echo "[git-precheck] ERROR: expected branch main, got "$BRANCH""
  exit 1
fi
echo "[git-precheck] branch: $BRANCH OK"

# ── 2b. Ensure git author email matches GitHub (Vercel rejects otherwise) ──
EXPECTED_EMAIL="229847808+th3ghote-blip@users.noreply.github.com"
EXPECTED_NAME="th3ghote-blip"
CURRENT_EMAIL=$(git config --get user.email 2>/dev/null || echo "")
if [ "$CURRENT_EMAIL" != "$EXPECTED_EMAIL" ]; then
  git config user.email "$EXPECTED_EMAIL"
  git config user.name "$EXPECTED_NAME"
  echo "[git-precheck] author: set repo-local to $EXPECTED_EMAIL (was '$CURRENT_EMAIL')"
else
  echo "[git-precheck] author: $CURRENT_EMAIL OK"
fi

# ── 3. Report working tree status ──────────────────────────────────────────
STATUS=$(GIT_INDEX_FILE=/tmp/vanta_precheck_idx git read-tree HEAD 2>/dev/null && GIT_INDEX_FILE=/tmp/vanta_precheck_idx git status --porcelain 2>/dev/null || git status --porcelain 2>/dev/null || echo "(git status failed)")
if [ -z "$STATUS" ]; then
  echo "[git-precheck] working tree: clean OK"
else
  echo "[git-precheck] WARNING: working tree has uncommitted changes:"
  echo "$STATUS"
fi

echo "[git-precheck] done"
