#!/usr/bin/env bash
set -e

export DEBUG_VISUAL=true
export NODE_ENV=development
export REMOTE_DEBUG_PORT=${REMOTE_DEBUG_PORT:-9222}

echo "[DEBUG] Lancement du scraper en mode visuel (Chromium non-headless + remote debugging ${REMOTE_DEBUG_PORT})..."

node server.js

