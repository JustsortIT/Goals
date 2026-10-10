#!/bin/sh
# Copies the shell from PubPixels, which owns it, over the copy here. Run it from the top of
# this repo, with pubpixels checked out beside it:   sh tools/sync-shell.sh
#
# The shell is what every type of game shares on a kiosk: its credit, lives and scores, the
# pixel font. It is never changed here. A game that needs something of it changed asks for the
# change in PubPixels, and this brings it back.
set -eu
FROM="${1:-../pubpixels}/app/frontend/game/shell"
[ -d "$FROM" ] || { echo "No shell at $FROM. Pass the path to pubpixels." >&2; exit 1; }
rm -rf src/shell
mkdir -p src/shell
cp -R "$FROM"/. src/shell/
rm -f src/shell/CLAUDE.md
{
  echo "This folder is a copy of app/frontend/game/shell in PubPixels. Do not edit it here."
  echo "Copied by tools/sync-shell.sh from commit $(git -C "${1:-../pubpixels}" rev-parse --short HEAD) on $(date +%Y-%m-%d)."
} > src/shell/COPIED_FROM
echo "Copied the shell: $(cat src/shell/COPIED_FROM | tail -1)"
