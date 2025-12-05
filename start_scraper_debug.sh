#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

export NODE_ENV=development
export DEBUG_VISUAL=${DEBUG_VISUAL:-true}
export FORCE_BROWSER=webkit
export HEADLESS=false
export KEEP_BROWSER_OPEN=true
export PWDEBUG=console
PORT_ENV=${PORT:-3001}

echo "[DEBUG] Arrêt du process PM2 'scraper-backend' (si présent)..."
pm2 stop scraper-backend >/dev/null 2>&1 || true

echo "[DEBUG] Libération du port ${PORT_ENV}..."
fuser -k "${PORT_ENV}"/tcp >/dev/null 2>&1 || true

echo "[DEBUG] Lancement du scraper en mode visuel WebKit (Safari Playwright)"
node server.js
