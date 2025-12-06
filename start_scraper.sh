#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Production : Chromium "headed" via Xvfb pour éviter les blocages anti-headless
export NODE_ENV=production
export FORCE_BROWSER=${FORCE_BROWSER:-chromium}
export HEADLESS=false
export KEEP_BROWSER_OPEN=false
export DEBUG_VISUAL=false
export REMOTE_DEBUG_PORT=${REMOTE_DEBUG_PORT:-9222}
export DISPLAY=${DISPLAY:-:99}

echo "[PM2] Démarrage du scraper (Chromium headed via Xvfb)…"
exec xvfb-run -a -s "-screen 0 1920x1080x24" node server.js

