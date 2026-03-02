#!/usr/bin/env bash
# replace-vanilla.sh — Replace vanilla GSD with the autopilot fork
# Usage: bash bin/replace-vanilla.sh [--dry-run]

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

FORK_NAME="get-more-shit-done"
FORK_REPO="https://github.com/skspade/get-more-shit-done"
GSD_DIR="$HOME/.claude/get-shit-done"
VERSION_FILE="$GSD_DIR/VERSION"
FORK_FILE="$GSD_DIR/FORK"
DRY_RUN=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: bash bin/replace-vanilla.sh [--dry-run]"
      echo ""
      echo "Replace vanilla GSD (get-shit-done) with the autopilot fork."
      echo "Handles uninstall of existing installation and fresh install."
      echo ""
      echo "Options:"
      echo "  --dry-run   Show what would happen without making changes"
      echo "  --help      Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown flag: $arg${RESET}"
      echo "Usage: bash bin/replace-vanilla.sh [--dry-run]"
      exit 1
      ;;
  esac
done

# Helpers
info()    { echo -e "${CYAN}→${RESET} $1"; }
success() { echo -e "${GREEN}✓${RESET} $1"; }
warn()    { echo -e "${YELLOW}!${RESET} $1"; }
fail()    { echo -e "${RED}✗${RESET} $1"; exit 1; }
dry()     { echo -e "${DIM}[dry-run]${RESET} $1"; }

run_or_dry() {
  if $DRY_RUN; then
    dry "$1"
  else
    eval "$2"
  fi
}

echo ""
echo -e "${BOLD}GSD Fork Replacement${RESET}"
echo -e "${DIM}Replace vanilla get-shit-done with the autopilot fork${RESET}"
echo ""

if $DRY_RUN; then
  echo -e "${YELLOW}╔══════════════════════════════════╗${RESET}"
  echo -e "${YELLOW}║         DRY RUN MODE             ║${RESET}"
  echo -e "${YELLOW}║  No changes will be made         ║${RESET}"
  echo -e "${YELLOW}╚══════════════════════════════════╝${RESET}"
  echo ""
fi

# ─── Phase 1: Prerequisites ───────────────────────────────────────────
info "Phase 1: Checking prerequisites..."

# Check node
if ! command -v node &>/dev/null; then
  fail "node is not installed. Install Node.js >= 16.7 and try again."
fi

NODE_VERSION=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
NODE_MINOR=$(echo "$NODE_VERSION" | cut -d. -f2)
if [ "$NODE_MAJOR" -lt 16 ] || { [ "$NODE_MAJOR" -eq 16 ] && [ "$NODE_MINOR" -lt 7 ]; }; then
  fail "Node.js >= 16.7 required (found v${NODE_VERSION})"
fi

# Check running from repo root
if [ ! -f "bin/install.js" ]; then
  fail "Must run from the fork repo root (bin/install.js not found). cd into the repo and try again."
fi

# Check ~/.claude/ exists
if [ ! -d "$HOME/.claude" ]; then
  fail "~/.claude/ does not exist. Run Claude Code at least once first."
fi

success "Prerequisites OK (node v${NODE_VERSION})"

# ─── Phase 2: Detect current installation ─────────────────────────────
info "Phase 2: Detecting current installation..."

INSTALL_STATE="none"
if [ -f "$VERSION_FILE" ]; then
  CURRENT_VERSION=$(cat "$VERSION_FILE" 2>/dev/null || echo "unknown")
  if [ -f "$FORK_FILE" ]; then
    INSTALL_STATE="fork"
    success "Fork already installed (v${CURRENT_VERSION})"
  else
    INSTALL_STATE="vanilla"
    success "Vanilla GSD detected (v${CURRENT_VERSION})"
  fi
else
  success "No existing GSD installation found"
fi

# ─── Phase 3: Uninstall existing installation ─────────────────────────
if [ "$INSTALL_STATE" != "none" ]; then
  if [ "$INSTALL_STATE" = "fork" ]; then
    info "Phase 3: Uninstalling existing fork installation (will re-install)..."
  else
    info "Phase 3: Uninstalling vanilla GSD..."
  fi
  run_or_dry \
    "node bin/install.js --claude --global --uninstall" \
    "node bin/install.js --claude --global --uninstall"
  if ! $DRY_RUN; then
    success "Uninstall complete"
  fi
else
  info "Phase 3: Skipping uninstall (nothing installed)"
fi

# ─── Phase 4: Build hooks ─────────────────────────────────────────────
info "Phase 4: Building hooks..."
run_or_dry \
  "node scripts/build-hooks.js" \
  "node scripts/build-hooks.js"
if ! $DRY_RUN; then
  if [ ! -d "hooks/dist" ]; then
    fail "hooks/dist/ not created. Check scripts/build-hooks.js output."
  fi
  success "Hooks built"
else
  dry "Would verify hooks/dist/ exists"
fi

# ─── Phase 5: Install fork ────────────────────────────────────────────
info "Phase 5: Installing fork..."
run_or_dry \
  "node bin/install.js --claude --global --force-statusline" \
  "node bin/install.js --claude --global --force-statusline"
if ! $DRY_RUN; then
  success "Fork installed"
fi

# ─── Phase 6: Write FORK marker ───────────────────────────────────────
info "Phase 6: Writing FORK marker..."
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
FORK_CONTENT="name=${FORK_NAME}
repo=${FORK_REPO}
commit=${COMMIT_HASH}
installed=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if $DRY_RUN; then
  dry "Would write $FORK_FILE with:"
  echo -e "${DIM}${FORK_CONTENT}${RESET}"
else
  echo "$FORK_CONTENT" > "$FORK_FILE"
  success "FORK marker written"
fi

# ─── Phase 7: Install CLI entry point ─────────────────────────────────
info "Phase 7: Installing gsd-autopilot CLI..."

CLI_WRAPPER="$GSD_DIR/scripts/gsd-autopilot"
CLI_LINK="$HOME/.local/bin/gsd-autopilot"
REPO_WRAPPER="bin/gsd-autopilot"

if [ ! -f "$REPO_WRAPPER" ]; then
  warn "bin/gsd-autopilot not found in repo — skipping CLI install"
else
  run_or_dry \
    "cp $REPO_WRAPPER → $CLI_WRAPPER" \
    "cp \"$REPO_WRAPPER\" \"$CLI_WRAPPER\" && chmod +x \"$CLI_WRAPPER\""

  run_or_dry \
    "mkdir -p ~/.local/bin" \
    "mkdir -p \"$HOME/.local/bin\""

  run_or_dry \
    "symlink $CLI_LINK → $CLI_WRAPPER" \
    "ln -sf \"$CLI_WRAPPER\" \"$CLI_LINK\""

  if ! $DRY_RUN; then
    success "gsd-autopilot CLI installed"
  fi

  # Check if ~/.local/bin is on PATH
  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.local/bin"; then
    warn "~/.local/bin is not on your PATH"
    echo -e "  ${DIM}Add this to your shell profile (~/.bashrc or ~/.zshrc):${RESET}"
    echo -e "  ${DIM}  export PATH=\"\$HOME/.local/bin:\$PATH\"${RESET}"
  fi
fi

# ─── Phase 8: Verify installation ─────────────────────────────────────
info "Phase 8: Verifying installation..."

VERIFY_PASS=true
check_file() {
  local label="$1"
  local filepath="$2"
  if $DRY_RUN; then
    dry "Would check: $label"
    return
  fi
  if [ -e "$filepath" ]; then
    success "$label"
  else
    warn "Missing: $label ($filepath)"
    VERIFY_PASS=false
  fi
}

CLAUDE_DIR="$HOME/.claude"
check_file "VERSION"          "$GSD_DIR/VERSION"
check_file "FORK"             "$FORK_FILE"
check_file "gsd-tools.cjs"   "$GSD_DIR/bin/gsd-tools.cjs"
check_file "agents/"          "$CLAUDE_DIR/agents"
check_file "commands/gsd/"    "$CLAUDE_DIR/commands/gsd"
check_file "hooks/"           "$CLAUDE_DIR/hooks"
check_file "manifest"         "$CLAUDE_DIR/gsd-file-manifest.json"
check_file "gsd-autopilot CLI" "$CLI_LINK"

if ! $DRY_RUN && ! $VERIFY_PASS; then
  warn "Some files are missing — installation may be incomplete"
fi

# ─── Done ──────────────────────────────────────────────────────────────
echo ""
if $DRY_RUN; then
  echo -e "${BOLD}Dry run complete.${RESET} Run without --dry-run to apply changes."
else
  INSTALLED_VERSION=$(cat "$VERSION_FILE" 2>/dev/null || echo "unknown")
  echo -e "${GREEN}${BOLD}Fork replacement complete!${RESET}"
  echo -e "  Version: ${CYAN}${INSTALLED_VERSION}${RESET}"
  echo -e "  Commit:  ${CYAN}${COMMIT_HASH}${RESET}"
  echo -e ""
  echo -e "${DIM}Start a new Claude Code session to use the fork.${RESET}"
  echo -e "${DIM}Run 'gsd-autopilot --help' to launch autopilot from any project.${RESET}"
fi
