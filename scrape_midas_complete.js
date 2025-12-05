/**
 * Scraper Midas historique (basé sur la version "qui fonctionnait")
 * → Adapté pour fermer automatiquement les popups anti-bot.
 */

const { chromium, webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEBUG_VISUAL = process.env.DEBUG_VISUAL === 'true';
const REMOTE_DEBUG_PORT = Number(process.env.REMOTE_DEBUG_PORT || 9222);
const DEBUG_SCREENSHOT_DIR = path.join(__dirname, 'debug-screenshots');

const ensureDebugDir = () => {
  if (!DEBUG_VISUAL) return;
  if (!fs.existsSync(DEBUG_SCREENSHOT_DIR)) {
    fs.mkdirSync(DEBUG_SCREENSHOT_DIR, { recursive: true });
  }
};

const logStep = (message) => {
  console.log(`[SCRAPER] ${message}`);
};

const debugScreenshot = async (page, label) => {
  if (!DEBUG_VISUAL || !page) return;
  ensureDebugDir();
  const safe = label.replace(/\s+/g, '-');
  const filePath = path.join(
    DEBUG_SCREENSHOT_DIR,
    `${Date.now()}-${safe}.png`
  );
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`[DEBUG] Screenshot enregistré → ${filePath}`);
};
const servicesFile = require('./services_config.json');
const servicesList = Array.isArray(servicesFile.services)
  ? servicesFile.services
  : Object.values(servicesFile);

const selectionLabelMap = {
  'plaquette-avant': 'Plaquette avant',
  'plaquette-arriere': 'Plaquette arrière',
  'plaquette-arrere': 'Plaquette arrière',
  'plaquettes-avant': 'Plaquette avant',
  'plaquettes-arriere': 'Plaquette arrière',
  'disque-avant': 'Disque avant',
  'disque-arriere': 'Disque arrière',
  'disques-avant': 'Disque avant',
  'disques-arriere': 'Disque arrière',
  'amortisseurs-avant': 'Amortisseurs avant',
  'amortisseurs-arriere': 'Amortisseurs arrière',
  'amortisseur-avant': 'Amortisseurs avant',
  'amortisseur-arriere': 'Amortisseurs arrière',
  'les-deux': 'Les deux',
  'avant': 'Plaquette avant',
  'arriere': 'Plaquette arrière',
  'balai-conducteur': 'Balai avant côté conducteur',
  'balai-passager': 'Balai avant côté passager',
  'balais-tous': 'Tous',
  'batterie-sans-start-stop': "Je n'ai pas le start & stop",
  'batterie-avec-start-stop': "J'ai le start & stop",
};

const escapeRegExp = (value = '') =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeTextForMatch = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const buildSelectionMatchers = (type, targetLabel) => {
  const normalized = normalizeTextForMatch(targetLabel);
  if (!normalized) {
    return [];
  }

  const matchers = [];
  const push = (...tokens) => {
    const cleaned = tokens
      .map((token) => normalizeTextForMatch(token))
      .filter(Boolean);
    if (cleaned.length) {
      matchers.push(cleaned);
    }
  };

  push(...normalized.split(' '));
  push(normalized);

  if (type === 'plaquettes') {
    if (normalized.includes('avant')) push('plaqu', 'avant');
    if (normalized.includes('arri')) push('plaqu', 'arri');
    if (normalized.includes('deux')) {
      push('les', 'deux');
      push('avant', 'arri');
    }
  } else if (type === 'disques') {
    if (normalized.includes('avant')) push('disque', 'avant');
    if (normalized.includes('arri')) push('disque', 'arri');
    if (normalized.includes('deux')) push('les', 'deux');
  } else if (type === 'amortisseurs') {
    if (normalized.includes('avant')) push('amortisseur', 'avant');
    if (normalized.includes('arri')) push('amortisseur', 'arri');
    if (normalized.includes('deux')) push('les', 'deux');
  } else if (type === 'balais') {
    if (normalized.includes('conducteur')) push('balai', 'conducteur');
    if (normalized.includes('passager')) push('balai', 'passager');
    if (normalized === 'tous') push('balai', 'tous');
  } else if (type === 'batterie') {
    if (normalized.includes('pas')) push('start', 'stop', 'pas');
    else push('start', 'stop');
  }

  return matchers;
};

const matchesAnyPattern = (normalizedValue, matchers = []) =>
  matchers.some((tokens) => tokens.every((token) => normalizedValue.includes(token)));

const resolveHeadlessMode = () => {
  if (DEBUG_VISUAL) return false;
  if (process.env.KEEP_BROWSER_OPEN === 'true') return false;
  if (process.env.HEADLESS === 'false') return false;
  return true;
};

const CHROMIUM_HEADLESS_ARGS = [
  '--disable-gpu',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-blink-features=AutomationControlled',
];

const buildChromiumLaunchOptions = (headless) => ({
  headless,
  args: DEBUG_VISUAL
    ? [
        `--remote-debugging-port=${REMOTE_DEBUG_PORT}`,
        '--start-maximized',
        '--disable-gpu',
      ]
    : headless
    ? [...CHROMIUM_HEADLESS_ARGS]
    : ['--disable-blink-features=AutomationControlled'],
});

const buildWebkitLaunchOptions = (headless) => ({
  headless,
  args: headless ? ['--disable-blink-features=AutomationControlled'] : [],
});

const buildSelectionFilters = (type, targetLabel) => {
  const filters = [];
  const normalized = normalizeTextForMatch(targetLabel);
  if (!normalized) {
    return filters;
  }

  const pushFilter = (regex) => {
    if (regex) {
      filters.push(regex);
    }
  };

  if (type === 'plaquettes') {
    pushFilter(/plaqu/i);
  } else if (type === 'disques') {
    pushFilter(/disque/i);
  } else if (type === 'amortisseurs') {
    pushFilter(/amortisseur/i);
  } else if (type === 'balais') {
    pushFilter(/balai/i);
  } else if (type === 'batterie') {
    pushFilter(/start/i);
  }

  if (normalized.includes('avant')) {
    pushFilter(/avant/i);
  } else if (normalized.includes('arri')) {
    pushFilter(/arri[eè]re/i);
  } else if (normalized.includes('conducteur')) {
    pushFilter(/conducteur/i);
  } else if (normalized.includes('passager')) {
    pushFilter(/passager/i);
  } else if (normalized.includes('deux')) {
    pushFilter(/deux/i);
  } else if (normalized.includes('tous')) {
    pushFilter(/tous/i);
  } else if (normalized.includes('pas')) {
    pushFilter(/pas/i);
  }

  // Ajout d'un filtre précis sur la chaîne complète (tolère les variations de casse)
  pushFilter(new RegExp(escapeRegExp(targetLabel), 'i'));

  return filters;
};

const slugify = (value) => {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const clone = (value) => JSON.parse(JSON.stringify(value));

function resolveServiceConfig(url, selectionSlug) {
  const normalizedSelection = slugify(selectionSlug);
  let match = null;

  if (normalizedSelection) {
    match = servicesList.find((service) => {
      const idSlug = slugify(service.id);
      const midasSlug = slugify(service.midasService);
      const idAlt = idSlug.replace(/s$/, '');
      const midasAlt = midasSlug.replace(/s$/, '');
      return (
        idSlug === normalizedSelection ||
        midasSlug === normalizedSelection ||
        idAlt === normalizedSelection ||
        midasAlt === normalizedSelection
      );
    });
  }

  if (!match && url) {
    match = servicesList.find((service) => service.midasUrl === url);
  }

  const resolved = match
    ? clone(match)
    : {
        id: selectionSlug || 'custom',
        midasService: selectionSlug || 'custom',
        midasUrl: url,
        hasSelection: !!selectionSlug,
        selectionType: null,
      };

  if (normalizedSelection && selectionLabelMap[normalizedSelection]) {
    resolved.__forcedSelectionLabel = selectionLabelMap[normalizedSelection];
    resolved.hasSelection = true;
  }

  return resolved;
}

async function closeDetectionPopups(page) {
  let closed = false;

  const swalButton = page
    .locator('.swal2-container button.swal2-confirm, .swal2-actions button')
    .filter({ hasText: /ok|d'accord|compris/i })
    .first();
  if (await swalButton.count().catch(() => 0)) {
    try {
      await swalButton.click({ timeout: 500 });
      closed = true;
      console.log('⚠️  Popup SweetAlert fermée');
      await page.waitForTimeout(220);
    } catch (_) {}
  }

  const wrongPlateButton = page
    .locator(
      'midas-wrong-plate-number-modal button, .modal-content button.midas-btn'
    )
    .filter({ hasText: /ok|compris/i })
    .first();
  if (await wrongPlateButton.count().catch(() => 0)) {
    try {
      await wrongPlateButton.click({ timeout: 500 });
      closed = true;
      console.log('⚠️  Modal "Vérifiez la plaque" fermée');
      await page.waitForTimeout(220);
    } catch (_) {}
  }

  if (closed) {
    try {
      const radio = page
        .locator('label:has-text("Immatriculation") input[type="radio"], input#displayPlateSection')
        .first();
      if (await radio.count().catch(() => 0)) {
        await radio.click({ timeout: 500 });
        await page.waitForTimeout(220);
        console.log('   🔁 Section "Immatriculation" réactivée après popup');
      } else {
        const label = page.locator('label:has-text("Immatriculation")').first();
        if (await label.count().catch(() => 0)) {
          await label.click({ timeout: 500 });
          await page.waitForTimeout(220);
          console.log('   🔁 Label "Immatriculation" cliqué après popup');
        }
      }
    } catch (_) {}
  }

  return closed;
}

async function runScrapeFlow(plate, serviceConfig = null) {
  let browser = null;
  let context = null;

  try {
    // Si pas de config, on ne peut pas scraper
    if (!serviceConfig || !serviceConfig.midasUrl) {
      return { success: false, error: 'Configuration du service manquante' };
    }

    const headless = resolveHeadlessMode();
    if (DEBUG_VISUAL) {
      const chromiumOptions = buildChromiumLaunchOptions(false);
      browser = await chromium.launch(chromiumOptions);
      logStep('Chromium lancé en mode visuel (remote debugging actif)');
    } else {
      try {
        const webkitOptions = buildWebkitLaunchOptions(headless);
        browser = await webkit.launch(webkitOptions);
        logStep(
          `WebKit lancé (${webkitOptions.headless ? 'headless' : 'headed'})`
        );
      } catch (webkitError) {
        console.log(
          '   ⚠️  WebKit indisponible, fallback Chromium:',
          webkitError.message
        );
        const chromiumOptions = buildChromiumLaunchOptions(headless);
        browser = await chromium.launch(chromiumOptions);
        logStep(
          `Chromium lancé (${chromiumOptions.headless ? 'headless' : 'headed'})`
        );
      }
    }
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    let page = await context.newPage();

    const ensureActivePage = async () => {
      if (page && !page.isClosed()) {
        return page;
      }
      const pages = context?.pages?.() || [];
      const fallback = [...pages].reverse().find((p) => !p.isClosed());
      if (!fallback) {
        throw new Error('Aucune page active disponible après la validation');
      }
      page = fallback;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return page;
    };

    const handlePostValidationNavigation = async (pendingNewPagePromise = null) => {
      let newPage = null;
      if (pendingNewPagePromise) {
        try {
          newPage = await pendingNewPagePromise;
        } catch (_) {
          newPage = null;
        }
      }

      if (newPage) {
        console.log('   🔄 Nouvelle page détectée après validation');
        page = newPage;
        await page
          .waitForLoadState('networkidle', { timeout: 5000 })
          .catch(async () => {
            await page.waitForLoadState('domcontentloaded').catch(() => {});
          });
        await page.waitForTimeout(220).catch(() => {});
        await closeDetectionPopups(page);
        await ensureActivePage();
        return true;
      }

      if (!page || page.isClosed()) {
        throw new Error('La page principale s’est fermée après la validation');
      }

      await page
        .waitForLoadState('networkidle', { timeout: 5000 })
        .catch(async () => {
          await page.waitForLoadState('domcontentloaded').catch(() => {});
        });
      await page.waitForTimeout(220).catch(() => {});
      await closeDetectionPopups(page);
      await ensureActivePage();
      return false;
    };

    // Étape 1: Aller sur la page de devis
    logStep(`Navigation vers ${serviceConfig.midasUrl}`);
    await page.goto(serviceConfig.midasUrl, { waitUntil: 'networkidle' });
    await debugScreenshot(page, 'apres-navigation');
    await page
      .waitForSelector(
        'input[placeholder*="AB123CD"], input[name*="plate"], label:has-text("Mon numéro de plaque")',
        { timeout: 5000 }
      )
      .catch(async () => {
        await page.waitForTimeout(320);
      });
    await closeDetectionPopups(page);

    // Étape 2: Accepter les cookies (comme dans la version qui fonctionnait)
    logStep('Tentative acceptation cookies');
    try {
      const acceptButton = await page.locator('button:has-text("Accepter et continuer")').first();
      if (await acceptButton.isVisible({ timeout: 3000 })) {
        await acceptButton.click();
        await acceptButton.waitFor({ state: 'hidden', timeout: 2000 }).catch(async () => {
          await page.waitForTimeout(260);
        });
        console.log('   ✅ Cookies acceptés');
      }
    } catch (e) {
      console.log('   ℹ️  Pas de popup cookie');
    }

    // Étape 3: Trouver et remplir le champ plaque (logique qui fonctionnait)
    logStep('Recherche du champ immatriculation (AB123CD)');
    await debugScreenshot(page, 'avant-recherche-champ');
    await page
      .waitForSelector('input[placeholder*="AB123CD"], input[name*="plate"], form:has-text("Mon numéro de plaque")', {
        timeout: 4000,
      })
      .catch(async () => {
        await page.waitForTimeout(220);
      });
    
    let plateInput = null;
    
    // Méthode 1: Chercher par placeholder
    try {
      const inputByPlaceholder = await page.locator('input[placeholder*="AB123CD"]').first();
      if (await inputByPlaceholder.isVisible({ timeout: 2000 })) {
        plateInput = inputByPlaceholder;
        logStep('Champ trouvé par placeholder');
      }
    } catch (e) {
      // Continuer
    }
    
    // Méthode 2: Chercher dans la section "Mon numéro de plaque"
    if (!plateInput) {
      try {
        const plateSection = await page.locator('text="Mon numéro de plaque"').first();
        if (await plateSection.isVisible({ timeout: 2000 })) {
          logStep('Section "Mon numéro de plaque" trouvée');
          
          const sectionInput = await plateSection.locator('..').locator('input').first();
          if (await sectionInput.isVisible({ timeout: 1000 })) {
            const value = await sectionInput.inputValue() || '';
            if (value.includes('AB123CD') || value.includes('AB-123-CD')) {
              plateInput = sectionInput;
              logStep(`Champ trouvé dans la section (valeur: "${value}")`);
            }
          }
        }
      } catch (e) {
        // Continuer
      }
    }
    
    // Méthode 3: Chercher tous les inputs et trouver celui avec "AB123CD"
    if (!plateInput) {
      try {
        const allInputs = await page.locator('input[type="text"], input[type="search"], input').all();
        logStep(`${allInputs.length} champs trouvés → filtrage sur AB123CD`);
        
        for (const input of allInputs) {
          try {
            const isVisible = await input.isVisible();
            if (!isVisible) continue;
            
            const value = await input.inputValue() || '';
            const normalizedValue = value.replace(/[\s-]/g, '').toUpperCase();
            
            if (normalizedValue === 'AB123CD' || value.includes('AB123CD') || value.includes('AB-123-CD')) {
              plateInput = input;
              logStep(`Champ trouvé via valeur "${value}"`);
              break;
            }
          } catch (e) {
            // Continuer
          }
        }
      } catch (e) {
        console.log(`   ❌ Erreur: ${e.message}`);
      }
    }
    
    if (!plateInput) {
      throw new Error('Champ avec "AB123CD" non trouvé');
    }

    // Étape 4: Cliquer sur l'input et le focus
    logStep('Clic sur le champ immatriculation');
    await plateInput.click();
    await page.waitForTimeout(260);
    await plateInput.focus();
    await page.waitForTimeout(180);
    logStep('Champ cliqué et focus');
    
    // Étape 5: Vider le champ avec Ctrl+A puis Delete (méthode plus humaine)
    logStep('Vidage du champ immatriculation');
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(140);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(180);
    
    const valueAfterClear = await plateInput.inputValue() || '';
    if (valueAfterClear.length > 0) {
      // Si ça n'a pas marché, essayer avec Backspace
      await plateInput.click({ clickCount: 3 });
      await page.waitForTimeout(140);
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(140);
    }
    logStep('Champ vidé');
    
    // Étape 6: Taper la plaque avec le clavier (simulation plus humaine)
    logStep(`Saisie de la plaque "${plate}"`);
    await plateInput.focus();
    await page.waitForTimeout(140);
    
    // Utiliser keyboard.type() au lieu de input.type() pour simuler un vrai clavier
    for (let i = 0; i < plate.length; i++) {
      await page.keyboard.type(plate[i], { delay: 80 + Math.random() * 40 }); // Délai variable 80-120ms
      await page.waitForTimeout(50 + Math.random() * 50); // Petite pause aléatoire
    }
    await page.waitForTimeout(260);
    logStep(`Plaque "${plate}" saisie`);
    
    // Étape 7: Déclencher tous les événements possibles (comme un vrai utilisateur)
    logStep('Déclenchement des événements sur le champ');
    await page.evaluate((input) => {
      // Focus
      input.focus();
      const focusEvent = new Event('focus', { bubbles: true, cancelable: true });
      input.dispatchEvent(focusEvent);
      
      // Input
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      input.dispatchEvent(inputEvent);
      
      // Keyup
      const keyupEvent = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter' });
      input.dispatchEvent(keyupEvent);
      
      // Change
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      input.dispatchEvent(changeEvent);
      
      // Blur (comme si on sortait du champ)
      const blurEvent = new Event('blur', { bubbles: true, cancelable: true });
      input.dispatchEvent(blurEvent);
    }, await plateInput.elementHandle());
    await page.waitForTimeout(220);
    logStep('Événements déclenchés');
    
    // Vérifier la valeur finale
    const finalValue = await plateInput.inputValue() || '';
    logStep(`Valeur finale dans le champ: "${finalValue}"`);
    
    if (finalValue !== plate && finalValue.replace(/[\s-]/g, '').toUpperCase() !== plate.replace(/[\s-]/g, '').toUpperCase()) {
      throw new Error(`La plaque ne correspond pas: attendu "${plate}", obtenu "${finalValue}"`);
    }
    
    logStep('La plaque correspond');

    // Étape 8: Cliquer sur "Continuer" (logique qui fonctionnait)
    logStep('Recherche du bouton Continuer');
    await page.waitForTimeout(220);
    
    let continueClicked = false;
    
    try {
      const continueButton = await page.locator('button, [type="submit"], [role="button"], a')
        .filter({ hasText: /continuer/i })
        .first();
      
      if (await continueButton.isVisible({ timeout: 3000 })) {
        await continueButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(140);
        
        const buttonText = await continueButton.textContent();
        logStep(`Bouton détecté: "${buttonText?.trim()}"`);
        
        const newPagePromise = context.waitForEvent('page', { timeout: 6000 }).catch(() => null);
        await continueButton.click();
        logStep('Bouton "Continuer" cliqué');
        await debugScreenshot(page, 'apres-continuer');
        await handlePostValidationNavigation(newPagePromise);
        continueClicked = true;
      } else {
        console.log('   ⚠️  Bouton "Continuer" non visible');
      }
    } catch (e) {
      console.log(`   ⚠️  Erreur lors de la recherche du bouton: ${e.message}`);
    }
    
    // Si le bouton n'a pas été trouvé, essayer d'autres méthodes
    if (!continueClicked) {
      try {
        const allButtons = await page.locator('button, [type="submit"]').all();
        console.log(`   🔍 ${allButtons.length} boutons trouvés, recherche de "Continuer"...`);
        
        for (const button of allButtons) {
          try {
            const isVisible = await button.isVisible();
            if (!isVisible) continue;
            
            const text = await button.textContent() || '';
            if (text.trim().toLowerCase().includes('continuer')) {
              await button.scrollIntoViewIfNeeded();
              await page.waitForTimeout(140);
              const newPagePromise = context.waitForEvent('page', { timeout: 6000 }).catch(() => null);
              await button.click();
              console.log(`   ✅ Bouton "Continuer" cliqué (texte: "${text.trim()}")`);
              await handlePostValidationNavigation(newPagePromise);
              continueClicked = true;
              break;
            }
          } catch (e) {
            // Continuer
          }
        }
      } catch (e) {
        console.log(`   ❌ Erreur: ${e.message}`);
      }
    }

    if (!continueClicked) {
      console.log('   ↩️  Tentative de validation via la touche Entrée...');
      try {
        await plateInput.focus();
        await page.waitForTimeout(150);
        const newPagePromise = context.waitForEvent('page', { timeout: 6000 }).catch(() => null);
        await page.keyboard.press('Enter');
        const switched = await handlePostValidationNavigation(newPagePromise);

        if (switched || (await page.locator('text=/Votre véhicule/i').first().count().catch(() => 0))) {
          continueClicked = true;
          console.log('   ✅ Navigation confirmée via la touche Entrée');
        } else {
          console.log('   ⚠️  Aucune confirmation visuelle après la touche Entrée');
        }
      } catch (e) {
        console.log(`   ⚠️  Impossible de valider via Entrée: ${e.message}`);
      }
    }

    if (!continueClicked) {
      throw new Error('Bouton Continuer non cliqué');
    }

    // Étape 6: Sélectionner le service (SEULEMENT si hasSelection === true)
    if (serviceConfig.hasSelection) {
      await ensureActivePage();
      console.log('🔧 Sélection du service...');
      await page
        .waitForLoadState('networkidle', { timeout: 4000 })
        .catch(async () => {
          await page.waitForLoadState('domcontentloaded').catch(() => {});
        });
      await page
        .waitForSelector(
          'label:has-text("Plaquette"), label:has-text("Disque"), label:has-text("Amortisseur"), label:has-text("Balai"), label:has-text("start"), button:has-text("Les deux")',
          { timeout: 4000 }
        )
        .catch(async () => {
          await page.waitForTimeout(260);
        });

      const combinedLocator = page.locator(
        'label, button, a, [role="button"], [class*="button"], [class*="selectable"], [class*="option"], [class*="card"], [class*="choice"], div.panel, div.card, div.panel-body, div.panel-heading'
      );

      const serviceId = serviceConfig.midasService;
      let targetSelection = null;

      if (serviceConfig.selectionType === 'plaquettes') {
        if (serviceId.includes('avant') && !serviceId.includes('arriere')) {
          targetSelection = 'Plaquette avant';
        } else if (serviceId.includes('arriere') && !serviceId.includes('avant')) {
          targetSelection = 'Plaquette arrière';
        } else if (serviceId.includes('avant') && serviceId.includes('arriere')) {
          targetSelection = 'Les deux';
        }
      } else if (serviceConfig.selectionType === 'disques') {
        if (serviceId.includes('avant') && !serviceId.includes('arriere')) {
          targetSelection = 'Disque avant';
        } else if (serviceId.includes('arriere') && !serviceId.includes('avant')) {
          targetSelection = 'Disque arrière';
        } else if (serviceId.includes('avant') && serviceId.includes('arriere')) {
          targetSelection = 'Les deux';
        }
      } else if (serviceConfig.selectionType === 'amortisseurs') {
        if (serviceId.includes('avant') && !serviceId.includes('arriere') && !serviceId.includes('complet')) {
          targetSelection = 'Amortisseurs avant';
        } else if (serviceId.includes('arriere') && !serviceId.includes('avant') && !serviceId.includes('complet')) {
          targetSelection = 'Amortisseurs arrière';
        } else if (serviceId.includes('complet') || (serviceId.includes('avant') && serviceId.includes('arriere'))) {
          targetSelection = 'Les deux';
        }
      } else if (serviceConfig.selectionType === 'balais') {
        if (serviceId.includes('conducteur')) {
          targetSelection = 'Balai avant côté conducteur';
        } else if (serviceId.includes('passager')) {
          targetSelection = 'Balai avant côté passager';
        } else if (serviceId.includes('tous')) {
          targetSelection = 'Tous';
        }
      } else if (serviceConfig.selectionType === 'batterie') {
        targetSelection = "Je n'ai pas le start & stop";
      }

      if (serviceConfig.__forcedSelectionLabel) {
        targetSelection = serviceConfig.__forcedSelectionLabel;
      }

      if (!targetSelection) {
        throw new Error(`Impossible de déterminer la sélection pour ${serviceId}`);
      }

      console.log(`   🎯 Recherche de: "${targetSelection}"`);

      const matchers = buildSelectionMatchers(
        serviceConfig.selectionType,
        targetSelection
      );

      if (!matchers.length) {
        throw new Error(`Aucun motif de sélection valide pour "${targetSelection}"`);
      }

      const selectionFilters = buildSelectionFilters(
        serviceConfig.selectionType,
        targetSelection
      );

      const optionCount = Math.min(await combinedLocator.count(), 150);
      let containerElement = null;

      if (selectionFilters.length) {
        let filteredLocator = combinedLocator;
        for (const filter of selectionFilters) {
          filteredLocator = filteredLocator.filter({ hasText: filter });
        }
        if ((await filteredLocator.count().catch(() => 0)) > 0) {
          containerElement = filteredLocator.first();
        }
      }

      if (!containerElement) {
        for (let i = 0; i < optionCount; i++) {
          const candidate = combinedLocator.nth(i);
          let rawText = '';
          try {
            rawText = (await candidate.textContent()) || '';
          } catch (_) {
            continue;
          }

          const normalizedText = normalizeTextForMatch(rawText);
          if (!normalizedText) continue;

          if (matchesAnyPattern(normalizedText, matchers)) {
            containerElement = candidate;
            break;
          }
        }
      }

      if (!containerElement) {
        const snippets = [];
        for (let i = 0; i < Math.min(optionCount, 12); i++) {
          try {
            const textChunk = await combinedLocator
              .nth(i)
              .textContent()
              .catch(() => '');
            const snippet = (textChunk || '').trim().replace(/\s+/g, ' ');
            if (snippet) {
              snippets.push(snippet.slice(0, 120));
            }
          } catch (_) {}
        }

        if (snippets.length) {
          console.log('   🐞 Aucune correspondance. Extraits analysés:', snippets);
        }
        throw new Error(`Élément "${targetSelection}" non trouvé`);
      }

      let finalLocator = containerElement;
      const clickableChild = containerElement
        .locator('button, a, input[type="radio"], input[type="checkbox"]')
        .first();
      if (await clickableChild.count().catch(() => 0)) {
        finalLocator = clickableChild;
      }

      await page.waitForTimeout(180);

      try {
        await finalLocator.click({ timeout: 5000 });
      } catch (clickError) {
        try {
          const handle = await finalLocator.elementHandle();
          if (!handle) throw clickError;
          await finalLocator.evaluate((el) => el.click());
        } catch (_) {
          throw new Error(
            `Impossible de cliquer sur "${targetSelection}": ${clickError.message}`
          );
        }
      }

      logStep(`"${targetSelection}" sélectionné`);
      await page.waitForTimeout(520);
      await closeDetectionPopups(page);
      await ensureActivePage();
    } else {
      console.log('⏭️  Pas de sélection nécessaire, passage direct au calcul...');
      await page
        .waitForLoadState('networkidle', { timeout: 3000 })
        .catch(async () => {
          await page.waitForTimeout(320);
        });
    }

    // Étape 7: Cliquer sur "Je calcule mon devis"
    logStep('Recherche du bouton "Je calcule mon devis"');
    await debugScreenshot(page, 'avant-calcul');
    await page
      .waitForSelector('button:has-text("Je calcule"), button:has-text("calculer mon devis"), a:has-text("calculer")', {
        timeout: 4000,
      })
      .catch(async () => {
        await page.waitForTimeout(320);
      });

    try {
      await closeDetectionPopups(page);
      const calculateButton = await page.locator('button, a, [role="button"], [type="submit"], div[class*="button"]')
        .filter({ hasText: /calculer mon devis|valider mon devis|je calcule|calculer/i })
        .first();

      if (await calculateButton.isVisible({ timeout: 3000 })) {
        await calculateButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(140);
        await calculateButton.click();
        logStep('Bouton "Je calcule mon devis" cliqué');
        await page
          .waitForLoadState('networkidle', { timeout: 5000 })
          .catch(async () => {
            await page.waitForTimeout(520);
          });
        await page.waitForTimeout(1800);
        await closeDetectionPopups(page);
        await ensureActivePage();
      } else {
        // Recherche alternative
        const allButtons = await page.locator('button, a, [role="button"], [type="submit"], div, span').all();
        for (const btn of allButtons) {
          try {
            const text = await btn.textContent() || '';
            const normalizedText = text.toLowerCase();
            if (normalizedText.includes('calculer') || normalizedText.includes('valider') || 
                (normalizedText.includes('devis') && normalizedText.includes('mon'))) {
              const isVisible = await btn.isVisible({ timeout: 1000 }).catch(() => false);
              if (isVisible) {
                await btn.scrollIntoViewIfNeeded();
                await page.waitForTimeout(140);
                try {
                  await btn.click({ timeout: 3000 });
                  logStep(`Bouton calcul cliqué: "${text.trim()}"`);
                  await page
                    .waitForLoadState('networkidle', { timeout: 5000 })
                    .catch(async () => {
                      await page.waitForTimeout(520);
                    });
                  await page.waitForTimeout(1800);
                  await closeDetectionPopups(page);
                  await ensureActivePage();
                  break;
                } catch (clickError) {
                  try {
                  await page.evaluate((el) => el.click(), await btn.elementHandle());
                  logStep(`Bouton calcul cliqué via JS: "${text.trim()}"`);
                    await page
                      .waitForLoadState('networkidle', { timeout: 5000 })
                      .catch(async () => {
                        await page.waitForTimeout(520);
                      });
                    await page.waitForTimeout(1800);
                    await closeDetectionPopups(page);
                    await ensureActivePage();
                    break;
                  } catch (e) {
                    // Continuer
                  }
                }
              }
            }
          } catch (e) {
            // Continuer
          }
        }
      }
    } catch (e) {
      throw new Error('Bouton calculer non trouvé');
    }

    // Étape 8: Extraire le prix
    logStep('Extraction du prix');
    await page
      .waitForSelector('[class*="price"], [class*="montant"], text=/€/', { timeout: 5000 })
      .catch(async () => {
        await page.waitForTimeout(320);
      });
    await ensureActivePage();
    await page.waitForTimeout(900);
    await debugScreenshot(page, 'avant-extraction-prix');

    let price = null;
    const priceSelectors = [
      '[class*="price"]',
      '[class*="total"]',
      '[class*="amount"]',
      '[data-price]',
      '[class*="devis"]',
      '[class*="montant"]',
      'span:has-text("€")',
      'div:has-text("€")',
      'p:has-text("€")'
    ];

    for (const selector of priceSelectors) {
      try {
        const priceElements = await page.locator(selector).all();
        for (const element of priceElements) {
          try {
            const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
            if (!isVisible) continue;
            const text = await element.textContent() || '';
            const priceMatch = text.match(/(\d+[.,]\d+)\s*€/);
            if (priceMatch) {
              const extractedPrice = parseFloat(priceMatch[1].replace(',', '.'));
              if (extractedPrice >= 10 && extractedPrice <= 10000) {
                price = extractedPrice;
                break;
              }
            }
          } catch (e) {
            // Continuer
          }
        }
        if (price) break;
      } catch (e) {
        // Continuer
      }
    }

    if (!price) {
      const activePage = await ensureActivePage();
      const pageText = await activePage.content();
      const allPriceMatches = pageText.matchAll(/(\d+[.,]\d+)\s*€/g);
      const prices = [];
      for (const match of allPriceMatches) {
        const extractedPrice = parseFloat(match[1].replace(',', '.'));
        if (extractedPrice >= 10 && extractedPrice <= 10000) {
          prices.push(extractedPrice);
        }
      }
      if (prices.length > 0) {
        price = Math.max(...prices);
      }
    }

    if (!price) {
      throw new Error('Prix non trouvé sur la page');
    }

    console.log(`   ✅ Prix trouvé: ${price}€`);

    return { 
      success: true, 
      price, 
      url: page.url(),
      plate,
      serviceId: serviceConfig.id || serviceConfig.midasService
    };

  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    return { 
      success: false, 
      error: error.message,
      plate,
      serviceId: serviceConfig?.id || serviceConfig?.midasService
    };
  } finally {
    if (browser) {
      try {
        const pages = context?.pages?.() || [];
        if (pages.length) {
          await Promise.all(
            pages.map((p) => p.waitForTimeout(4000).catch(() => {}))
          );
        } else if (page) {
          await page.waitForTimeout(4000).catch(() => {});
        }
      } catch (_) {
        // Ignorer les erreurs lors de l'attente avant la fermeture
      }
      await browser.close();
    }
  }
}

async function scrapeMidasComplete(plate, url, selectionSlug = null) {
  const serviceConfig = resolveServiceConfig(url, selectionSlug);
  console.log(
    `🧭 Service résolu: ${serviceConfig.midasService || 'inconnu'} (sélection: ${
      selectionSlug || 'aucune'
    })`
  );
  return runScrapeFlow(plate, serviceConfig);
}

module.exports = { scrapeMidasComplete };

if (require.main === module) {
  const args = process.argv.slice(2);
  const plate = args[0] || 'CC368ER';
  const url =
    args[1] ||
    'https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere';
  const selection = args[2] || null;

  scrapeMidasComplete(plate, url, selection)
    .then((result) => {
      console.log('Résultat:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Erreur:', error);
      process.exit(1);
    });
}

