/**
 * NOUVEAU SYSTÈME DE SCRAPING MIDAS V2
 * Approche simple et humaine avec Safari (WebKit)
 * 
 * Usage: node scrape_midas_v2.js [plaque] [service_id]
 * Exemple: node scrape_midas_v2.js CC368ER plaquettes-avant
 */

const { chromium, webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

// Charger la configuration
const servicesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'services_config.json'), 'utf8'));
const services = Array.isArray(servicesConfig.services) ? servicesConfig.services : Object.values(servicesConfig);

async function scrapeMidasV2(plate, serviceId) {
  let browser = null;
  let page = null;

  try {
    // Trouver le service
    const service = services.find(s => s.id === serviceId);
    if (!service || !service.midasUrl) {
      throw new Error(`Service ${serviceId} non trouvé ou URL manquante`);
    }

    console.log('═'.repeat(60));
    console.log('🚀 NOUVEAU SYSTÈME DE SCRAPING MIDAS V2');
    console.log('═'.repeat(60));
    console.log(`📋 Plaque: ${plate}`);
    console.log(`🔧 Service: ${service.name}`);
    console.log(`🌐 URL: ${service.midasUrl}`);
    console.log('');

    // Lancer Safari (WebKit) avec une configuration très simple
    console.log('🌐 Lancement de Safari (WebKit)...');
    try {
      browser = await webkit.launch({
        headless: false,
        slowMo: 100, // Ralentir toutes les actions de 100ms
      });
      console.log('   ✅ Safari lancé');
    } catch (webkitError) {
      console.log('   ⚠️  WebKit non disponible, utilisation de Chromium');
      browser = await chromium.launch({
        headless: false,
        slowMo: 100,
        args: [
          '--start-maximized',
          '--disable-blink-features=AutomationControlled',
        ]
      });
    }

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
    });

    page = await context.newPage();

    // Masquer webdriver (uniquement pour Chromium)
    if (browser.browserType().name() === 'chromium') {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        delete navigator.__proto__.webdriver;
      });
    }

    // Étape 1: Aller sur la page (attendre complètement le chargement)
    console.log('📍 Navigation vers la page...');
    await page.goto(service.midasUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    // Attendre que la page soit complètement chargée
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000); // Attente supplémentaire
    console.log('   ✅ Page chargée');

    // Étape 2: Accepter les cookies
    console.log('🍪 Gestion des cookies...');
    await page.waitForTimeout(2000);
    
    try {
      // Chercher le bouton "Accepter et Continuer" (texte exact)
      const cookieSelectors = [
        'button:has-text("Accepter et Continuer")',
        'button:has-text("Accepter et continuer")',
        'button:has-text("ACCEPTER ET CONTINUER")',
        'button:has-text("Accepter")',
        'button:has-text("accepter")',
        '[id*="cookie"] button',
        '[class*="cookie"] button',
      ];

      let cookieAccepted = false;
      for (const selector of cookieSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 3000 })) {
            const buttonText = await button.textContent();
            console.log(`   🔍 Bouton trouvé: "${buttonText?.trim()}"`);
            await button.click({ delay: 100 });
            await page.waitForTimeout(2000);
            console.log('   ✅ Cookies acceptés');
            cookieAccepted = true;
            break;
          }
        } catch (e) {
          // Continuer
        }
      }
      
      if (!cookieAccepted) {
        console.log('   ℹ️  Pas de popup cookie détectée');
      }
    } catch (e) {
      console.log('   ℹ️  Pas de popup cookie');
    }

    // Étape 3: Trouver le champ de la plaque (méthode très simple)
    console.log('🔍 Recherche du champ plaque...');
    await page.waitForTimeout(2000);

    // Attendre qu'un input soit visible
    await page.waitForSelector('input[type="text"], input[type="search"], input:not([type="hidden"])', { 
      timeout: 10000 
    });

    // Trouver tous les inputs
    const inputs = await page.locator('input[type="text"], input[type="search"], input:not([type="hidden"])').all();
    console.log(`   🔍 ${inputs.length} champ(s) trouvé(s)`);

    let plateInput = null;
    for (const input of inputs) {
      try {
        const isVisible = await input.isVisible();
        if (!isVisible) continue;

        const placeholder = await input.getAttribute('placeholder') || '';
        const value = await input.inputValue() || '';
        const name = await input.getAttribute('name') || '';
        const id = await input.getAttribute('id') || '';

        // Chercher un champ qui ressemble à un champ de plaque
        if (placeholder.match(/AB|123|plaque|immatriculation/i) ||
            value.match(/AB|123/i) ||
            name.match(/plate|plaque|immatriculation/i) ||
            id.match(/plate|plaque|immatriculation/i)) {
          plateInput = input;
          console.log(`   ✅ Champ trouvé (placeholder: "${placeholder}", value: "${value}")`);
          break;
        }
      } catch (e) {
        // Continuer
      }
    }

    if (!plateInput && inputs.length > 0) {
      // Si pas trouvé, prendre le premier input visible
      for (const input of inputs) {
        if (await input.isVisible()) {
          plateInput = input;
          console.log('   ✅ Premier champ visible utilisé');
          break;
        }
      }
    }

    if (!plateInput) {
      throw new Error('Champ plaque non trouvé');
    }

    // Étape 4: Vérifier et remplacer la plaque (comme dans l'ancien système)
    console.log(`⌨️  Vérification et remplacement de la plaque...`);
    
    // Lire la valeur actuelle du champ
    const currentValue = await plateInput.inputValue() || '';
    console.log(`   📋 Valeur actuelle dans le champ: "${currentValue}"`);
    
    // Si le champ contient déjà une plaque (comme "AB123CD"), il faut la remplacer
    if (currentValue && currentValue.length > 0) {
      console.log('   🔄 Plaque existante détectée, remplacement...');
      
      // Cliquer sur le champ
      await plateInput.click({ delay: 100 });
      await page.waitForTimeout(500);
      
      // Sélectionner tout le texte (Ctrl+A ou triple clic)
      await plateInput.click({ clickCount: 3, delay: 50 });
      await page.waitForTimeout(200);
      
      // Supprimer avec Backspace
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300);
      
      // Vérifier que c'est bien vide
      const afterClear = await plateInput.inputValue() || '';
      if (afterClear.length > 0) {
        // Si pas vide, essayer avec Ctrl+A puis Delete
        await page.keyboard.press('Control+a');
        await page.waitForTimeout(200);
        await page.keyboard.press('Delete');
        await page.waitForTimeout(300);
      }
      
      console.log('   ✅ Ancienne plaque supprimée');
    } else {
      // Si le champ est vide, juste cliquer dessus
      await plateInput.click({ delay: 100 });
      await page.waitForTimeout(500);
    }

    // Taper la nouvelle plaque caractère par caractère avec des délais variables
    console.log(`   ⌨️  Saisie de la nouvelle plaque "${plate}"...`);
    for (let i = 0; i < plate.length; i++) {
      const char = plate[i];
      await page.keyboard.type(char, { delay: 150 + Math.random() * 100 }); // 150-250ms par caractère
      await page.waitForTimeout(50 + Math.random() * 50); // Petite pause aléatoire
    }

    // Pause après la saisie (comme si on relisait)
    await page.waitForTimeout(1000 + Math.random() * 500);

    // Vérifier que la plaque est bien là
    const enteredValue = await plateInput.inputValue();
    console.log(`   📋 Valeur finale dans le champ: "${enteredValue}"`);

    if (enteredValue.replace(/[\s-]/g, '').toUpperCase() !== plate.replace(/[\s-]/g, '').toUpperCase()) {
      throw new Error(`La plaque ne correspond pas: attendu "${plate}", obtenu "${enteredValue}"`);
    }

    console.log('   ✅ Plaque remplacée correctement');

    // Étape 5: Cliquer sur "Continuer" (attendre qu'il apparaisse)
    console.log('➡️  Recherche du bouton "Continuer"...');
    await page.waitForTimeout(2000);

    // Attendre que le bouton soit visible
    let continueButton = null;
    const continueSelectors = [
      'button:has-text("Continuer")',
      'button:has-text("CONTINUER")',
      'button:has-text("continuer")',
      '[type="submit"]:has-text("Continuer")',
      'a:has-text("Continuer")',
    ];

    for (const selector of continueSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          continueButton = button;
          break;
        }
      } catch (e) {
        // Continuer
      }
    }

    if (!continueButton) {
      // Chercher dans tous les boutons
      const allButtons = await page.locator('button, [type="submit"], a[role="button"]').all();
      for (const btn of allButtons) {
        try {
          const text = await btn.textContent();
          if (text && text.trim().toLowerCase().includes('continuer')) {
            if (await btn.isVisible()) {
              continueButton = btn;
              break;
            }
          }
        } catch (e) {
          // Continuer
        }
      }
    }

    if (!continueButton) {
      throw new Error('Bouton "Continuer" non trouvé');
    }

    console.log('   ✅ Bouton "Continuer" trouvé');
    
    // Scroller vers le bouton et cliquer
    await continueButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await continueButton.click({ delay: 100 });
    console.log('   ✅ Clic sur "Continuer"');
    
    // Attendre la page suivante
    await page.waitForTimeout(5000);

    // Étape 6: Si sélection nécessaire, faire la sélection
    if (service.hasSelection && service.selectionOptions) {
      console.log('🔧 Sélection du service...');
      await page.waitForTimeout(3000);

      // Déterminer quelle option sélectionner
      let targetOption = null;
      if (serviceId.includes('avant') && !serviceId.includes('arriere') && !serviceId.includes('complet')) {
        targetOption = service.selectionOptions.find(opt => 
          opt.toLowerCase().includes('avant') && !opt.toLowerCase().includes('arrière') && !opt.toLowerCase().includes('les deux')
        );
      } else if (serviceId.includes('arriere') && !serviceId.includes('avant') && !serviceId.includes('complet')) {
        targetOption = service.selectionOptions.find(opt => 
          opt.toLowerCase().includes('arrière') && !opt.toLowerCase().includes('avant') && !opt.toLowerCase().includes('les deux')
        );
      }

      if (targetOption) {
        console.log(`   🎯 Recherche de: "${targetOption}"`);
        
        // Chercher l'option
        const allElements = await page.locator('button, div, span, a, [role="button"]').all();
        let optionFound = false;

        for (const elem of allElements) {
          try {
            const text = await elem.textContent();
            if (text && text.trim().toLowerCase().includes(targetOption.toLowerCase().substring(0, 10))) {
              if (await elem.isVisible()) {
                await elem.scrollIntoViewIfNeeded();
                await page.waitForTimeout(300);
                await elem.click({ delay: 100 });
                console.log(`   ✅ Option sélectionnée: "${text.trim()}"`);
                await page.waitForTimeout(2000);
                optionFound = true;
                break;
              }
            }
          } catch (e) {
            // Continuer
          }
        }

        if (!optionFound) {
          console.log('   ⚠️  Option non trouvée, continuation...');
        }
      }
    }

    // Étape 7: Cliquer sur "Je calcule mon devis"
    console.log('💰 Recherche du bouton "Je calcule mon devis"...');
    await page.waitForTimeout(3000);

    const calculateSelectors = [
      'button:has-text("Je calcule mon devis")',
      'button:has-text("Calculer mon devis")',
      'button:has-text("calculer")',
      'button:has-text("CALCULER")',
    ];

    let calculateButton = null;
    for (const selector of calculateSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          calculateButton = button;
          break;
        }
      } catch (e) {
        // Continuer
      }
    }

    if (!calculateButton) {
      // Chercher dans tous les boutons
      const allButtons = await page.locator('button, [type="submit"]').all();
      for (const btn of allButtons) {
        try {
          const text = await btn.textContent();
          if (text && text.toLowerCase().includes('calcul')) {
            if (await btn.isVisible()) {
              calculateButton = btn;
              break;
            }
          }
        } catch (e) {
          // Continuer
        }
      }
    }

    if (!calculateButton) {
      throw new Error('Bouton "Je calcule mon devis" non trouvé');
    }

    console.log('   ✅ Bouton trouvé');
    await calculateButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await calculateButton.click({ delay: 100 });
    console.log('   ✅ Clic sur "Je calcule mon devis"');

    // Attendre le chargement du devis
    await page.waitForTimeout(8000);

    // Étape 8: Extraire le prix
    console.log('💰 Extraction du prix...');
    
    let price = null;
    const pageText = await page.locator('body').textContent();
    const priceMatches = pageText.match(/(\d+[,\\.]\d+)\s*€/g);
    
    if (priceMatches && priceMatches.length > 0) {
      // Prendre le plus grand prix (généralement le total)
      const prices = priceMatches.map(m => parseFloat(m.replace(/[^\d,.]/g, '').replace(',', '.')));
      price = Math.max(...prices);
      console.log(`   ✅ Prix trouvé: ${price.toFixed(2)}€`);
    } else {
      console.log('   ⚠️  Prix non trouvé dans le texte');
    }

    // Capture d'écran
    await page.screenshot({ path: `result_${serviceId}_${plate}.png`, fullPage: true });
    console.log(`   📸 Capture d'écran: result_${serviceId}_${plate}.png`);

    // Garder ouvert 15 secondes pour voir le résultat
    console.log('⏳ Attente de 15 secondes pour voir le résultat...');
    await page.waitForTimeout(15000);

    return {
      success: true,
      serviceId,
      serviceName: service.name,
      plate,
      price: price ? price.toFixed(2) : null,
      screenshot: `result_${serviceId}_${plate}.png`
    };

  } catch (error) {
    console.error(`\n❌ Erreur: ${error.message}`);
    
    if (page) {
      try {
        await page.screenshot({ path: `error_${serviceId}_${plate}.png`, fullPage: true });
        console.log(`📸 Capture d'écran d'erreur: error_${serviceId}_${plate}.png`);
      } catch (e) {
        // Ignorer
      }
    }

    return {
      success: false,
      serviceId,
      plate,
      error: error.message,
      screenshot: `error_${serviceId}_${plate}.png`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Exécution
const args = process.argv.slice(2);
const PLATE = args[0] || 'GH878CD';
const SERVICE_ID = args[1] || 'plaquettes-avant';

scrapeMidasV2(PLATE, SERVICE_ID).then(result => {
  console.log('\n' + '═'.repeat(60));
  if (result.success) {
    console.log('✅ SUCCÈS');
    console.log(`   Service: ${result.serviceName}`);
    console.log(`   Plaque: ${result.plate}`);
    if (result.price) {
      console.log(`   Prix: ${result.price}€`);
    }
  } else {
    console.log('❌ ÉCHEC');
    console.log(`   Erreur: ${result.error}`);
  }
  console.log('═'.repeat(60));
  process.exit(result.success ? 0 : 1);
});

