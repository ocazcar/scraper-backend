#!/usr/bin/env node
const { chromium } = require('playwright');

const REMOTE_DEBUG_PORT = Number(process.env.REMOTE_DEBUG_PORT || 9222);

async function main() {
  console.log(
    `[DEBUG] Lancement de Chromium non-headless sur le port de debug ${REMOTE_DEBUG_PORT}...`
  );

  const browser = await chromium.launch({
    headless: false,
    args: [
      `--remote-debugging-port=${REMOTE_DEBUG_PORT}`,
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--start-maximized',
    ],
  });

  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log(
    `[DEBUG] Chromium est prêt sur https://example.com (remote debugging sur ${REMOTE_DEBUG_PORT}).`
  );
  console.log('Laissez ce processus ouvert et connectez-vous avec chrome://inspect.');

  // On garde le process vivant pour permettre l’inspection depuis Chrome.
  process.stdin.resume();
}

main().catch((error) => {
  console.error('[DEBUG] Échec du lancement de Chromium :', error);
  process.exit(1);
});

