#!/usr/bin/env bash
# ============================================================================
# REWRITE COMMIT HISTORY to strip Claude/Codex mentions
# ============================================================================
#
# What this does:
#   1. Strips "Co-Authored-By: Claude ..." trailer lines from every commit body
#   2. Renames a few explicit commit subjects:
#        "Codex: signed URLs ..."           -> "Polish: signed URLs ..."
#        "Patch gaps in Codex's A/B/C: ..." -> "Patch gaps from earlier rounds: ..."
#        "Stop tracking .claude worktree"   -> "Stop tracking dev worktree directory"
#
# What this does NOT touch:
#   - Working tree files (those were scrubbed in a separate normal commit)
#   - Commits that legitimately mention "Anthropic Claude" as the LLM
#     provider in the AI routes (e.g. "Swap OpenAI to Anthropic Claude
#     across 6 AI routes") — that's a true technical fact about the stack
#     and reads as integration documentation, not an authorship leak.
#     Edit the AUTHOR_KEEP_PATTERNS array below if you want those stripped too.
#
# DESTRUCTIVE WARNINGS — read before running:
#   - Every commit SHA changes. Open PRs against your branch will break.
#   - Local clones on other machines must be re-cloned, NOT pulled.
#   - A force-push to the remote is required after this runs.
#   - Backup your repo before running (the script also stashes a backup ref).
#
# Run from repo root: bash scripts/rewrite-commit-history.sh
# After it finishes successfully: git push --force-with-lease origin main
#
# ============================================================================

set -euo pipefail

# Sanity: must be in repo root and on main
if [ ! -d ".git" ]; then
  echo "Error: run this from the repo root (where .git lives)." >&2
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "→ Current branch: $CURRENT_BRANCH"
echo "→ Creating backup ref: refs/backups/pre-scrub-$(date +%Y%m%d-%H%M%S)"
git update-ref "refs/backups/pre-scrub-$(date +%Y%m%d-%H%M%S)" HEAD

# Confirm
read -p "About to rewrite ALL commits on branch '$CURRENT_BRANCH'. Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted." >&2
  exit 1
fi

# Run filter-branch with a sed pipeline that does the three transforms.
# We disable the warning about filter-branch deprecation since filter-repo
# isn't always available on Windows / fresh installs.
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter '
  sed -E \
    -e "/^[Cc]o-?[Aa]uthored-?[Bb]y:.*[Cc]laude/d" \
    -e "/^[Cc]o-?[Aa]uthored-?[Bb]y:.*[Aa]nthropic/d" \
    -e "/^[Cc]o-?[Aa]uthored-?[Bb]y:.*codex/Id" \
    -e "s/^Codex: /Polish: /" \
    -e "s/^Patch gaps in Codex.s A\/B\/C:/Patch gaps from earlier rounds A\/B\/C:/" \
    -e "s/^Stop tracking \\.claude worktree.*$/Stop tracking dev worktree directory/" \
' -- --all

echo
echo "✅ History rewritten. Verify with:"
echo "     git log --oneline | head -30"
echo "     git log --all -i --grep=\"codex\\|claude\" | grep -i \"codex\\|claude\""
echo
echo "If the verification looks right, push:"
echo "     git push --force-with-lease origin $CURRENT_BRANCH"
echo
echo "If something looks wrong, restore from the backup ref:"
echo "     git reset --hard refs/backups/pre-scrub-<timestamp>"
echo
echo "After force-push, anyone else with a clone must run a fresh clone."
