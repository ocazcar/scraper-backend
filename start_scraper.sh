#!/usr/bin/env bash
set -e

# Script utilisé par PM2 pour lancer le backend en production (mode headless / WebKit)
export NODE_ENV=production
export DEBUG_VISUAL=false
export REMOTE_DEBUG_PORT=${REMOTE_DEBUG_PORT:-9222}

echo "[PM2] Démarrage du scraper en mode headless..."
node server.js

