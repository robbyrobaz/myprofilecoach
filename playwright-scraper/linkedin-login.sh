#!/usr/bin/env bash
# One-time LinkedIn login for the persistent Chrome scraper profile.
# Run this whenever the LinkedIn session expires:
#
#   ./linkedin-login.sh
#
# A Chrome window opens. Log into LinkedIn normally. When done, close the window.
# Then restart the scraper Chrome service:
#   systemctl --user restart linkedin-chrome

set -euo pipefail
export DISPLAY="${DISPLAY:-:0}"

CHROME_BIN="/home/rob/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome"
PROFILE_DIR="$(dirname "$0")/chrome-session"
mkdir -p "$PROFILE_DIR"

echo "Opening Chrome with scraper profile..."
echo "→ Log into LinkedIn, then close this Chrome window."
echo "→ After closing, run: systemctl --user restart linkedin-chrome"
echo ""

"$CHROME_BIN" \
  --no-sandbox \
  --disable-blink-features=AutomationControlled \
  --user-data-dir="$PROFILE_DIR" \
  --user-agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" \
  "https://www.linkedin.com/login"

echo "Chrome closed. Run: systemctl --user restart linkedin-chrome"
