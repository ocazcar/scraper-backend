/**
 * Fonction de test pour saisir la plaque de manière très humaine
 * Objectif : Arriver sur le site, entrer la plaque, cliquer sur Continuer
 * 
 * Usage: node test_plate_input_human.js [plaque] [url]
 * Exemple: node test_plate_input_human.js GH878CD https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere
 */

const { chromium, webkit, firefox } = require('playwright');

async function testPlateInputHuman(plate, url) {
  let browser = null;
  let context = null;

  try {
    console.log('🚀 Test de saisie de plaque (comportement humain)');
    console.log(`📋 Plaque: ${plate}`);
    console.log(`🌐 URL: ${url}`);
    console.log('');

    // Déterminer quel navigateur utiliser (par défaut: chromium)
    const browserType = process.env.BROWSER || 'chromium';
    const headlessMode = process.env.HEADLESS === 'true';
    console.log(`🌐 Utilisation du navigateur: ${browserType}`);
    console.log(`👁️  Mode headless: ${headlessMode ? 'Oui' : 'Non'}`);
    
    // Options pour masquer l'automatisation (stealth mode)
    const stealthOptions = {
      headless: headlessMode,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Optionnel : accélère le chargement
      ]
    };
    
    // Lancer le navigateur avec options stealth
    if (browserType === 'firefox') {
      browser = await firefox.launch({ headless: headlessMode });
      console.log('   ✅ Firefox lancé');
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0',
        viewport: { width: 1920, height: 1080 },
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        permissions: [],
        geolocation: { longitude: 2.3522, latitude: 48.8566 }, // Paris
        colorScheme: 'light'
      });
    } else if (browserType === 'webkit') {
      try {
        browser = await webkit.launch({ headless: headlessMode });
        console.log('   ✅ Safari WebKit lancé');
        context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          viewport: { width: 1920, height: 1080 },
          locale: 'fr-FR',
          timezoneId: 'Europe/Paris'
        });
      } catch (webkitError) {
        console.log('   ⚠️  WebKit non disponible, utilisation de Chromium');
        browser = await chromium.launch(stealthOptions);
        context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1920, height: 1080 },
          locale: 'fr-FR',
          timezoneId: 'Europe/Paris',
          permissions: [],
          geolocation: { longitude: 2.3522, latitude: 48.8566 }, // Paris
          colorScheme: 'light'
        });
      }
    } else {
      // Chromium par défaut avec options stealth
      browser = await chromium.launch(stealthOptions);
      console.log('   ✅ Chromium lancé (mode stealth)');
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        permissions: [],
        geolocation: { longitude: 2.3522, latitude: 48.8566 }, // Paris
        colorScheme: 'light',
        // Masquer les traces d'automatisation
        extraHTTPHeaders: {
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        }
      });
    }
    
    // Masquer les propriétés d'automatisation dans la page
    const page = await context.newPage();
    
    // Injecter du JavaScript pour masquer webdriver
    await page.addInitScript(() => {
      // Masquer webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Modifier les plugins pour paraître plus réel
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Modifier les langues
      Object.defineProperty(navigator, 'languages', {
        get: () => ['fr-FR', 'fr', 'en-US', 'en'],
      });
      
      // Masquer chrome
      window.chrome = {
        runtime: {},
      };
      
      // Modifier les permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    // Étape 1: Aller sur la page
    console.log('📍 Navigation vers la page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('   ✅ Page chargée');

    // Étape 2: Accepter les cookies
    console.log('🍪 Acceptation des cookies...');
    try {
      const acceptButton = await page.locator('button:has-text("Accepter"), button:has-text("accepter"), button:has-text("ACCEPTER")').first();
      if (await acceptButton.isVisible({ timeout: 3000 })) {
        // Simuler un mouvement de souris vers le bouton
        const box = await acceptButton.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
          await page.waitForTimeout(500);
        }
        await acceptButton.click();
        await page.waitForTimeout(1500);
        console.log('   ✅ Cookies acceptés');
      }
    } catch (e) {
      console.log('   ℹ️  Pas de popup cookie');
    }

    // Étape 3: Trouver le champ de la plaque
    console.log('🔍 Recherche du champ plaque...');
    await page.waitForTimeout(1000);
    
    let plateInput = null;
    
    // Méthode 1: Chercher par placeholder
    try {
      const inputByPlaceholder = await page.locator('input[placeholder*="AB"], input[placeholder*="ab"], input[placeholder*="123"]').first();
      if (await inputByPlaceholder.isVisible({ timeout: 2000 })) {
        plateInput = inputByPlaceholder;
        console.log('   ✅ Champ trouvé par placeholder');
      }
    } catch (e) {
      // Continuer
    }
    
    // Méthode 2: Chercher dans la section "Mon numéro de plaque"
    if (!plateInput) {
      try {
        const plateSection = await page.locator('text=/numéro.*plaque|plaque.*immatriculation/i').first();
        if (await plateSection.isVisible({ timeout: 2000 })) {
          const sectionInput = await plateSection.locator('..').locator('input').first();
          if (await sectionInput.isVisible({ timeout: 1000 })) {
            plateInput = sectionInput;
            console.log('   ✅ Champ trouvé dans la section');
          }
        }
      } catch (e) {
        // Continuer
      }
    }
    
    // Méthode 3: Chercher tous les inputs et trouver celui avec "AB123CD" ou similaire
    if (!plateInput) {
      try {
        const allInputs = await page.locator('input[type="text"], input[type="search"], input:not([type="hidden"])').all();
        console.log(`   🔍 ${allInputs.length} champs trouvés, recherche...`);
        
        for (const input of allInputs) {
          try {
            const isVisible = await input.isVisible();
            if (!isVisible) continue;
            
            const value = await input.inputValue() || '';
            const placeholder = await input.getAttribute('placeholder') || '';
            
            // Chercher un champ qui contient "AB" ou "123" dans la valeur ou le placeholder
            if (value.match(/AB|123|CD/i) || placeholder.match(/AB|123|CD|plaque/i)) {
              plateInput = input;
              console.log(`   ✅ Champ trouvé (valeur: "${value}", placeholder: "${placeholder}")`);
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
      throw new Error('Champ plaque non trouvé');
    }

    // Étape 4: Cliquer sur le champ (comme un humain)
    console.log('👆 Clic sur le champ...');
    const inputBox = await plateInput.boundingBox();
    if (inputBox) {
      // Mouvement de souris vers le champ
      await page.mouse.move(inputBox.x + inputBox.width / 2, inputBox.y + inputBox.height / 2, { steps: 15 });
      await page.waitForTimeout(300);
    }
    await plateInput.click();
    await page.waitForTimeout(500);
    await plateInput.focus();
    await page.waitForTimeout(300);
    console.log('   ✅ Champ cliqué et focus');

    // Étape 5: Vider le champ (comme un humain : Ctrl+A puis Delete)
    console.log('🗑️  Vidage du champ...');
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(400);
    
    // Vérifier que c'est vide
    const valueAfterClear = await plateInput.inputValue() || '';
    if (valueAfterClear.length > 0) {
      // Si pas vide, essayer autre méthode
      await plateInput.click({ clickCount: 3 });
      await page.waitForTimeout(200);
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300);
    }
    console.log('   ✅ Champ vidé');

    // Étape 6: Méthode simple avec fill() (la plus directe)
    console.log(`⌨️  Saisie de la plaque "${plate}" avec fill()...`);
    await plateInput.focus();
    await page.waitForTimeout(300);
    
    // Utiliser fill() qui est la méthode la plus simple et directe
    await plateInput.fill(plate);
    await page.waitForTimeout(500);
    
    // Déclencher les événements après fill()
    await page.evaluate((input) => {
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true }));
    }, await plateInput.elementHandle());
    
    await page.waitForTimeout(800);
    console.log(`   ✅ Plaque "${plate}" saisie`);

    // Étape 7: Vérifier que la plaque est bien là
    const finalValue = await plateInput.inputValue() || '';
    console.log(`   📋 Valeur dans le champ: "${finalValue}"`);
    
    if (finalValue.replace(/[\s-]/g, '').toUpperCase() !== plate.replace(/[\s-]/g, '').toUpperCase()) {
      console.log('   ⚠️  La valeur ne correspond pas, tentative avec type()...');
      // Essayer avec type() caractère par caractère
      await plateInput.clear();
      await page.waitForTimeout(200);
      await plateInput.type(plate, { delay: 100 });
      await page.waitForTimeout(500);
      
      const finalValue2 = await plateInput.inputValue() || '';
      if (finalValue2.replace(/[\s-]/g, '').toUpperCase() !== plate.replace(/[\s-]/g, '').toUpperCase()) {
        throw new Error(`La plaque ne correspond pas: attendu "${plate}", obtenu "${finalValue2}"`);
      }
    }
    console.log('   ✅ La plaque correspond !');
    
    // Attendre un peu pour voir si une erreur apparaît
    console.log('⏳ Attente de 3 secondes pour détecter d\'éventuelles erreurs...');
    await page.waitForTimeout(3000);
    
    // Vérifier s'il y a un bouton "OK" (pour fermer une erreur ou un popup)
    console.log('🔍 Recherche d\'un bouton "OK" pour fermer une éventuelle erreur...');
    try {
      // Chercher tous les éléments cliquables qui pourraient être un bouton OK
      const allClickableElements = await page.locator('button, [type="button"], [type="submit"], [role="button"], a, div[class*="button"], div[class*="btn"], span[class*="button"], span[class*="btn"]').all();
      
      let okButtonFound = false;
      
      for (const element of allClickableElements) {
        try {
          const isVisible = await element.isVisible({ timeout: 500 });
          if (!isVisible) continue;
          
          const text = await element.textContent();
          const trimmedText = text?.trim() || '';
          
          // Vérifier si le texte correspond à "OK" ou similaire
          if (trimmedText.match(/^(ok|OK|Ok|valider|Valider|VALIDER|fermer|Fermer|FERMER|accepter|Accepter|ACCEPTER|compris|Compris|COMPRIS)$/i)) {
            console.log(`   🔍 Bouton trouvé: "${trimmedText}"`);
            
            // Mouvement de souris vers le bouton
            const buttonBox = await element.boundingBox();
            if (buttonBox) {
              await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2, { steps: 15 });
              await page.waitForTimeout(300);
            }
            
            await element.click();
            await page.waitForTimeout(2000);
            console.log(`   ✅ Bouton "${trimmedText}" cliqué, erreur fermée`);
            okButtonFound = true;
            break;
          }
        } catch (e) {
          // Continuer avec l'élément suivant
        }
      }
      
      if (!okButtonFound) {
        console.log('   ℹ️  Aucun bouton "OK" trouvé');
      }
    } catch (e) {
      console.log(`   ⚠️  Erreur lors de la recherche du bouton OK: ${e.message}`);
    }
    
    // Vérifier s'il y a un message d'erreur sur la page (après avoir cliqué sur OK)
    await page.waitForTimeout(1000);
    try {
      const errorMessages = await page.locator('text=/erreur|error|invalide|non reconnu|non valide/i').all();
      if (errorMessages.length > 0) {
        const errorTexts = [];
        for (const errorMsg of errorMessages) {
          const text = await errorMsg.textContent();
          if (text && text.trim().length > 0) {
            errorTexts.push(text.trim());
          }
        }
        if (errorTexts.length > 0) {
          console.log(`   ⚠️  Messages d'erreur détectés: ${errorTexts.join(', ')}`);
          // Ne pas throw, juste logger, car on a peut-être déjà cliqué sur OK
        }
      }
    } catch (e) {
      // Ignorer
    }

    // Étape 9: Cliquer sur "Continuer" (comme un humain)
    console.log('➡️  Recherche du bouton "Continuer"...');
    await page.waitForTimeout(1500); // Pause comme si on lisait
    
    let continueButton = null;
    
    // Chercher le bouton "Continuer"
    try {
      continueButton = await page.locator('button, [type="submit"], [role="button"], a')
        .filter({ hasText: /continuer|CONTINUER/i })
        .first();
      
      if (await continueButton.isVisible({ timeout: 3000 })) {
        // Mouvement de souris vers le bouton
        const buttonBox = await continueButton.boundingBox();
        if (buttonBox) {
          await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2, { steps: 20 });
          await page.waitForTimeout(400);
        }
        
        await continueButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        
        const buttonText = await continueButton.textContent();
        console.log(`   🔍 Bouton trouvé: "${buttonText?.trim()}"`);
        
        // Clic sur le bouton
        await continueButton.click();
        console.log('   ✅ Bouton "Continuer" cliqué');
        
        // Attendre que la page suivante commence à charger
        await page.waitForTimeout(3000);
        console.log('   ✅ Page suivante en cours de chargement');
        
        return { success: true, message: 'Plaque saisie et bouton Continuer cliqué avec succès' };
      }
    } catch (e) {
      console.log(`   ⚠️  Erreur: ${e.message}`);
    }
    
    // Si le bouton n'a pas été trouvé, essayer une recherche alternative
    if (!continueButton) {
      console.log('   🔍 Recherche alternative du bouton...');
      const allButtons = await page.locator('button, a, [role="button"], [type="submit"]').all();
      for (const btn of allButtons) {
        try {
          const text = await btn.textContent() || '';
          if (text.trim().toLowerCase().includes('continuer')) {
            const btnBox = await btn.boundingBox();
            if (btnBox) {
              await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2, { steps: 20 });
              await page.waitForTimeout(400);
            }
            await btn.click();
            console.log(`   ✅ Bouton "Continuer" cliqué (texte: "${text.trim()}")`);
            await page.waitForTimeout(3000);
            return { success: true, message: 'Plaque saisie et bouton Continuer cliqué avec succès' };
          }
        } catch (e) {
          // Continuer
        }
      }
    }
    
    throw new Error('Bouton Continuer non trouvé');

  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    console.error(`   📍 Stack: ${error.stack}`);
    
    // Prendre une capture d'écran pour debug
    try {
      if (page) {
        await page.screenshot({ path: 'error_screenshot.png', fullPage: true });
        console.log('   📸 Capture d\'écran sauvegardée: error_screenshot.png');
      }
    } catch (screenshotError) {
      console.log('   ⚠️  Impossible de prendre une capture d\'écran');
    }
    
    return { success: false, error: error.message };
  } finally {
    // Garder le navigateur ouvert 10 secondes pour voir le résultat
    if (browser) {
      try {
        await page.waitForTimeout(10000);
      } catch (e) {
        // Ignorer
      }
      await browser.close();
    }
  }
}

// Exécution
const args = process.argv.slice(2);
const PLATE = args[0] || 'GH878CD';
const URL = args[1] || 'https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere';

// Permettre de spécifier le navigateur via argument ou variable d'environnement
// Exemple: BROWSER=firefox node test_plate_input_human.js GH878CD [url]
// ou: node test_plate_input_human.js GH878CD [url] firefox
if (args[2]) {
  process.env.BROWSER = args[2];
}

console.log('═'.repeat(60));
testPlateInputHuman(PLATE, URL).then(result => {
  console.log('═'.repeat(60));
  if (result.success) {
    console.log('✅ TEST RÉUSSI');
    console.log(`   ${result.message}`);
  } else {
    console.log('❌ TEST ÉCHOUÉ');
    console.log(`   Erreur: ${result.error}`);
  }
  console.log('═'.repeat(60));
  process.exit(result.success ? 0 : 1);
});

