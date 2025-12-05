/**
 * Script de scraping Midas
 * - Fonction avec sélection (plaquettes, disques, etc.)
 * - Fonction sans sélection (climatisation, embrayage, etc.)
 * 
 * Usage: node test_plate_input_only.js [plaque] [url] [service_id]
 * Exemple avec sélection: node test_plate_input_only.js CC368ER https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere plaquettes-avant
 * Exemple sans sélection: node test_plate_input_only.js CC368ER https://www.midas.fr/devis/prestations/climatisation climatisation
 */

const { webkit, chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testPlateInputOnly(plate, url, serviceId = null) {
  let browser = null;
  let page = null;

  try {
    console.log('═'.repeat(60));
    console.log('🧪 TEST SAISIE PLAQUE UNIQUEMENT');
    console.log('═'.repeat(60));
    console.log(`📋 Plaque à saisir: ${plate}`);
    console.log(`🌐 URL: ${url}`);
    console.log('');

    // Lancer Safari (WebKit)
    console.log('🌐 Lancement de Safari...');
    try {
      browser = await webkit.launch({ headless: false });
      console.log('   ✅ Safari lancé');
    } catch (webkitError) {
      console.log('   ⚠️  WebKit non disponible, utilisation de Chromium');
      browser = await chromium.launch({ headless: false });
    }

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });

    page = await context.newPage();

    // Aller sur la page
    console.log('📍 Navigation vers la page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    console.log('   ✅ Page chargée');

    // Accepter les cookies
    console.log('🍪 Gestion des cookies...');
    await page.waitForTimeout(2000);
    try {
      const cookieButton = page.locator('button:has-text("Accepter et Continuer"), button:has-text("Accepter et continuer")').first();
      if (await cookieButton.isVisible({ timeout: 3000 })) {
        await cookieButton.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ Cookies acceptés');
      }
    } catch (e) {
      console.log('   ℹ️  Pas de popup cookie');
    }

    // ÉTAPE 1: Localiser l'input par placeholder "AB123CD"
    console.log('🔍 Recherche du champ avec placeholder "AB123CD"...');
    await page.waitForTimeout(2000);

    let plateInput = null;

    // Méthode 1: Chercher par placeholder exact
    try {
      plateInput = await page.locator('input[placeholder*="AB123CD"]').first();
      if (await plateInput.isVisible({ timeout: 3000 })) {
        const placeholder = await plateInput.getAttribute('placeholder');
        console.log(`   ✅ Champ trouvé par placeholder: "${placeholder}"`);
      } else {
        plateInput = null;
      }
    } catch (e) {
      // Continuer
    }

    // Méthode 2: Chercher dans la zone "Mon numéro de plaque"
    if (!plateInput) {
      try {
        const plateSection = page.locator('text=/numéro.*plaque|plaque.*immatriculation/i').first();
        if (await plateSection.isVisible({ timeout: 3000 })) {
          console.log('   ✅ Section "Mon numéro de plaque" trouvée');
          // Chercher l'input dans cette section
          const sectionInput = await plateSection.locator('..').locator('input').first();
          if (await sectionInput.isVisible({ timeout: 2000 })) {
            const value = await sectionInput.inputValue() || '';
            const placeholder = await sectionInput.getAttribute('placeholder') || '';
            if (value.includes('AB123CD') || placeholder.includes('AB123CD')) {
              plateInput = sectionInput;
              console.log(`   ✅ Champ trouvé dans la section (value: "${value}", placeholder: "${placeholder}")`);
            }
          }
        }
      } catch (e) {
        // Continuer
      }
    }

    // Méthode 3: Chercher tous les inputs et trouver celui avec "AB123CD"
    if (!plateInput) {
      console.log('   🔍 Recherche dans tous les inputs...');
      const allInputs = await page.locator('input[type="text"], input[type="search"], input:not([type="hidden"])').all();
      console.log(`   🔍 ${allInputs.length} input(s) trouvé(s)`);

      for (const input of allInputs) {
        try {
          const isVisible = await input.isVisible();
          if (!isVisible) continue;

          const placeholder = await input.getAttribute('placeholder') || '';
          const value = await input.inputValue() || '';

          if (placeholder.includes('AB123CD') || value.includes('AB123CD')) {
            plateInput = input;
            console.log(`   ✅ Champ trouvé (placeholder: "${placeholder}", value: "${value}")`);
            break;
          }
        } catch (e) {
          // Continuer
        }
      }
    }

    if (!plateInput) {
      throw new Error('Champ avec placeholder "AB123CD" non trouvé');
    }

    // ÉTAPE 2: Cliquer sur l'input
    console.log('👆 Clic sur le champ...');
    await plateInput.click({ delay: 100 });
    await page.waitForTimeout(500);
    console.log('   ✅ Champ cliqué');

    // ÉTAPE 3: Vider le champ
    console.log('🗑️  Vidage du champ...');
    
    // Méthode 1: Sélectionner tout et supprimer
    await plateInput.click({ clickCount: 3, delay: 50 });
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Vérifier que c'est vide
    const afterClear = await plateInput.inputValue() || '';
    if (afterClear.length > 0) {
      // Méthode 2: Ctrl+A puis Delete
      await page.keyboard.press('Control+a');
      await page.waitForTimeout(200);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(300);
    }

    const finalClear = await plateInput.inputValue() || '';
    if (finalClear.length > 0) {
      // Méthode 3: fill('') directement
      await plateInput.fill('');
      await page.waitForTimeout(300);
    }

    console.log('   ✅ Champ vidé');

    // ÉTAPE 4: Taper la valeur caractère par caractère
    console.log(`⌨️  Saisie de "${plate}" caractère par caractère...`);
    
    for (let i = 0; i < plate.length; i++) {
      const char = plate[i];
      await page.keyboard.type(char, { delay: 150 + Math.random() * 100 }); // 150-250ms par caractère
      await page.waitForTimeout(50 + Math.random() * 50); // Petite pause aléatoire
    }

    await page.waitForTimeout(500);
    console.log(`   ✅ Plaque "${plate}" saisie`);

    // Vérifier la valeur
    const enteredValue = await plateInput.inputValue();
    console.log(`   📋 Valeur dans le champ: "${enteredValue}"`);

    // ÉTAPE 5: Déclencher les événements
    console.log('📡 Déclenchement des événements...');
    
    await page.evaluate((input) => {
      // Événement input
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      input.dispatchEvent(inputEvent);

      // Événement change
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      input.dispatchEvent(changeEvent);
    }, await plateInput.elementHandle());

    await page.waitForTimeout(1000);
    console.log('   ✅ Événements déclenchés');

    // Vérification finale
    const finalValue = await plateInput.inputValue();
    console.log(`\n📋 Valeur finale: "${finalValue}"`);

    if (finalValue.replace(/[\s-]/g, '').toUpperCase() === plate.replace(/[\s-]/g, '').toUpperCase()) {
      console.log('✅ SUCCÈS: La plaque a été correctement saisie !');
    } else {
      console.log('⚠️  ATTENTION: La plaque ne correspond pas exactement');
    }

    // ÉTAPE 6: Cliquer sur "Continuer" (comportement humain)
    console.log('\n➡️  Recherche du bouton "Continuer"...');
    await page.waitForTimeout(2000); // Pause comme si on relisait la plaque

    let continueButton = null;
    
    // Chercher le bouton "Continuer"
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

    // Si pas trouvé, chercher dans tous les boutons
    if (!continueButton) {
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
    
    // Comportement humain : scroller vers le bouton, pause, puis clic
    await continueButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // Pause avant de cliquer
    
    // Mouvement de souris vers le bouton (simulation humaine)
    try {
      const buttonBox = await continueButton.boundingBox();
      if (buttonBox) {
        await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2, { steps: 10 });
        await page.waitForTimeout(300); // Pause avant le clic
      }
    } catch (e) {
      // Si le mouvement de souris échoue, continuer quand même
    }
    
    // Clic avec délai (comportement humain)
    await continueButton.click({ delay: 100 });
    console.log('   ✅ Clic sur "Continuer" effectué');
    
    // Attendre que la page suivante commence à charger
    await page.waitForTimeout(3000);
    console.log('   ✅ Navigation vers la page suivante...');

    // ÉTAPE 7: Sélectionner le service (SEULEMENT si hasSelection === true) - LOGIQUE DE L'ANCIEN SCRIPT
    // Charger la configuration des services
    const servicesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'services_config.json'), 'utf8'));
    const services = Array.isArray(servicesConfig.services) ? servicesConfig.services : Object.values(servicesConfig);
    
    // Déterminer le service depuis l'URL ou serviceId
    let serviceConfig = null;
    if (serviceId) {
      serviceConfig = services.find(s => s.id === serviceId || s.midasService === serviceId);
    }
    if (!serviceConfig) {
      for (const s of services) {
        if (s.midasUrl === url) {
          serviceConfig = s;
          break;
        }
      }
    }

    if (serviceConfig && serviceConfig.hasSelection) {
      console.log('🔧 Sélection du service...');
      await page.waitForTimeout(5000);
      await page.waitForTimeout(2000);

      const allClickable = await page.locator('button, a, [role="button"], [class*="button"], div[class*="selectable"], div[class*="option"], div[class*="card"], div[class*="choice"]').all();
      const allDivs = await page.locator('div, span, p, li, td, label').all();
      const allElements = [...allClickable, ...allDivs];

      // Déterminer quelle option sélectionner selon le service
      const serviceId = serviceConfig.midasService || serviceConfig.id;
      let targetSelection = null;

      // Logique pour déterminer quelle option sélectionner
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
        targetSelection = 'Je n\'ai pas le start & stop';
      }

      if (!targetSelection) {
        throw new Error(`Impossible de déterminer la sélection pour ${serviceId}`);
      }

      console.log(`   🎯 Recherche de: "${targetSelection}"`);

      // Chercher l'élément correspondant
      let containerElement = null;

      for (let i = 0; i < allElements.length; i++) {
        try {
          const text = await allElements[i].textContent() || '';
          const normalizedText = text.toLowerCase();
          const targetNormalized = targetSelection.toLowerCase();

          // Pour "Les deux" et "Tous", chercher dans tous les éléments
          // Pour les autres, vérifier si l'élément contient le texte recherché
          if (targetSelection === 'Les deux' || targetSelection === 'Tous' || normalizedText.includes(targetNormalized)) {
            // Vérifications supplémentaires selon le type
            if (serviceConfig.selectionType === 'plaquettes') {
              const hasPlaquette = normalizedText.includes('plaquette');
              const hasAvant = normalizedText.includes('avant');
              const hasArriere = normalizedText.includes('arrière') || normalizedText.includes('arriere');
              const hasLesDeux = normalizedText.includes('les deux');

              if (targetSelection === 'Plaquette avant' && hasPlaquette && hasAvant && !hasLesDeux && !hasArriere) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'Plaquette arrière' && hasPlaquette && hasArriere && !hasLesDeux && !hasAvant) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'Les deux' && hasLesDeux) {
                containerElement = allElements[i];
                break;
              }
            } else if (serviceConfig.selectionType === 'disques') {
              const hasDisque = normalizedText.includes('disque');
              const hasAvant = normalizedText.includes('avant');
              const hasArriere = normalizedText.includes('arrière') || normalizedText.includes('arriere');
              const hasLesDeux = normalizedText.includes('les deux');

              if (targetSelection === 'Disque avant' && hasDisque && hasAvant && !hasLesDeux && !hasArriere) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'Disque arrière' && hasDisque && hasArriere && !hasLesDeux && !hasAvant) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'Les deux' && hasLesDeux) {
                containerElement = allElements[i];
                break;
              }
            } else if (serviceConfig.selectionType === 'amortisseurs') {
              const hasAmortisseurs = normalizedText.includes('amortisseurs');
              const hasAvant = normalizedText.includes('avant');
              const hasArriere = normalizedText.includes('arrière') || normalizedText.includes('arriere');
              const hasLesDeux = normalizedText.includes('les deux');

              if (targetSelection === 'Amortisseurs avant' && hasAmortisseurs && hasAvant && !hasLesDeux && !hasArriere) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'Amortisseurs arrière' && hasAmortisseurs && hasArriere && !hasLesDeux && !hasAvant) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'Les deux' && hasLesDeux) {
                containerElement = allElements[i];
                break;
              }
            } else if (serviceConfig.selectionType === 'balais') {
              const hasBalai = normalizedText.includes('balai') && !normalizedText.includes('balais');
              const hasConducteur = normalizedText.includes('conducteur');
              const hasPassager = normalizedText.includes('passager');
              const hasTous = normalizedText.includes('tous');
              
              if (targetSelection === 'Balai avant côté conducteur' && hasBalai && hasConducteur && !hasPassager && !hasTous) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'Balai avant côté passager' && hasBalai && hasPassager && !hasConducteur && !hasTous) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'Tous' && hasTous) {
                containerElement = allElements[i];
                break;
              }
            } else if (serviceConfig.selectionType === 'batterie') {
              const hasStartStop = normalizedText.includes('start') && (normalizedText.includes('stop') || normalizedText.includes('&'));
              const hasPas = normalizedText.includes('pas') || normalizedText.includes('n\'ai pas');
              const hasAvec = normalizedText.includes('j\'ai') || normalizedText.includes('j ai');
              
              if (targetSelection === 'Je n\'ai pas le start & stop' && hasStartStop && hasPas) {
                containerElement = allElements[i];
                break;
              } else if (targetSelection === 'J\'ai le start & stop' && hasStartStop && hasAvec) {
                containerElement = allElements[i];
                break;
              }
            }
          }
        } catch (e) {
          // Continuer
        }
      }

      if (containerElement) {
        const isVisible = await containerElement.isVisible({ timeout: 2000 }).catch(() => false);
        if (!isVisible) {
          await containerElement.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
        }

        try {
          await containerElement.click({ timeout: 3000 });
          console.log(`   ✅ "${targetSelection}" sélectionné`);
        } catch (clickError) {
          try {
            await page.evaluate((el) => el.click(), await containerElement.elementHandle());
            console.log(`   ✅ "${targetSelection}" sélectionné (JavaScript)`);
          } catch (jsError) {
            throw new Error(`Impossible de cliquer sur "${targetSelection}"`);
          }
        }
        await page.waitForTimeout(5000);
        await page.waitForTimeout(2000);
      } else {
        throw new Error(`Élément "${targetSelection}" non trouvé`);
      }
    } else {
      // Pas de sélection nécessaire, on attend juste un peu
      console.log('⏭️  Pas de sélection nécessaire, passage direct au calcul...');
      await page.waitForTimeout(3000);
      
      // Si serviceConfig n'existe pas, créer un objet minimal
      if (!serviceConfig) {
        serviceConfig = {
          id: serviceId || 'unknown',
          name: 'Service inconnu',
          midasService: serviceId || 'unknown'
        };
      }
    }

    // ÉTAPE 8: Cliquer sur "Je calcule mon devis" - LOGIQUE DE L'ANCIEN SCRIPT
    console.log('💰 Recherche du bouton "Je calcule mon devis"...');
    await page.waitForTimeout(2000);

    try {
      const calculateButton = await page.locator('button, a, [role="button"], [type="submit"], div[class*="button"]')
        .filter({ hasText: /calculer mon devis|valider mon devis|je calcule|calculer/i })
        .first();

      if (await calculateButton.isVisible({ timeout: 3000 })) {
        await calculateButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await calculateButton.click();
        console.log('   ✅ Bouton "Je calcule mon devis" cliqué');
        await page.waitForTimeout(5000);
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
                await page.waitForTimeout(500);
                try {
                  await btn.click({ timeout: 3000 });
                  console.log(`   ✅ Bouton trouvé: "${text.trim()}"`);
                  await page.waitForTimeout(5000);
                  break;
                } catch (clickError) {
                  try {
                    await page.evaluate((el) => el.click(), await btn.elementHandle());
                    console.log(`   ✅ Bouton cliqué (JavaScript): "${text.trim()}"`);
                    await page.waitForTimeout(5000);
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

    // ÉTAPE 9: Extraire le prix - LOGIQUE DE L'ANCIEN SCRIPT
    console.log('💶 Extraction du prix...');
    await page.waitForTimeout(3000);

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
      const pageText = await page.locator('body').textContent();
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

    if (price) {
      console.log(`   ✅ Prix trouvé: ${price}€`);
    } else {
      console.log('   ⚠️  Prix non trouvé sur la page');
    }

    // Prendre une capture d'écran finale
    await page.screenshot({ path: `test_plate_input_${plate}.png`, fullPage: true });
    console.log(`📸 Capture d'écran: test_plate_input_${plate}.png`);
    
    // Préparer les données à sauvegarder
    const resultData = {
      success: true,
      plate: plate,
      serviceId: serviceConfig?.id || serviceConfig?.midasService || 'unknown',
      serviceName: serviceConfig?.name || 'unknown',
      url: url,
      price: price ? parseFloat(price.toFixed(2)) : null,
      timestamp: new Date().toISOString(),
      screenshot: `test_plate_input_${plate}.png`
    };

    // Sauvegarder dans un fichier JSON
    const resultsDir = path.join(__dirname, 'scraping_results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const resultsFile = path.join(resultsDir, `scraping_results_${plate}_${new Date().toISOString().split('T')[0]}.json`);
    
    // Charger les résultats existants ou créer un nouveau fichier
    let allResults = [];
    if (fs.existsSync(resultsFile)) {
      try {
        const existingData = fs.readFileSync(resultsFile, 'utf8');
        allResults = JSON.parse(existingData);
      } catch (e) {
        allResults = [];
      }
    }

    // Ajouter le nouveau résultat
    allResults.push(resultData);

    // Sauvegarder
    fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2), 'utf8');
    console.log(`\n💾 Résultat sauvegardé dans: ${resultsFile}`);
    
    if (price) {
      console.log(`\n💰 Prix final: ${price}€`);
      console.log(`📋 Service: ${resultData.serviceName}`);
    }

    return { success: true, finalValue, price, resultData, resultsFile };

  } catch (error) {
    console.error(`\n❌ Erreur: ${error.message}`);
    
    if (page) {
      try {
        await page.screenshot({ path: `error_plate_input_${plate}.png`, fullPage: true });
        console.log(`📸 Capture d'écran d'erreur: error_plate_input_${plate}.png`);
      } catch (e) {
        // Ignorer
      }
    }

    // Sauvegarder l'erreur dans un fichier
    const resultsDir = path.join(__dirname, 'scraping_results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const errorFile = path.join(resultsDir, `scraping_errors_${plate}_${new Date().toISOString().split('T')[0]}.json`);
    
    let allErrors = [];
    if (fs.existsSync(errorFile)) {
      try {
        const existingData = fs.readFileSync(errorFile, 'utf8');
        allErrors = JSON.parse(existingData);
      } catch (e) {
        allErrors = [];
      }
    }

    const errorData = {
      success: false,
      plate: plate,
      url: url,
      error: error.message,
      timestamp: new Date().toISOString(),
      screenshot: `error_plate_input_${plate}.png`
    };

    allErrors.push(errorData);
    fs.writeFileSync(errorFile, JSON.stringify(allErrors, null, 2), 'utf8');
    console.log(`\n💾 Erreur sauvegardée dans: ${errorFile}`);
    
    return { success: false, error: error.message, errorData, errorFile };
  } finally {
    // Fermer le navigateur
    if (browser) {
      await browser.close();
      console.log('\n🔒 Navigateur fermé');
    }
  }
}

// Exécution
const args = process.argv.slice(2);
const PLATE = args[0] || 'CC368ER';
const URL = args[1] || 'https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere';
const SERVICE_ID = args[2] || null;

console.log('🚀 LANCEMENT DU SCRAPING');
console.log('');

testPlateInputOnly(PLATE, URL, SERVICE_ID).then(result => {
  console.log('\n' + '═'.repeat(60));
  if (result.success) {
    console.log('✅ SCRAPING RÉUSSI');
    console.log(`   Plaque: "${result.finalValue}"`);
    if (result.price) {
      console.log(`   Prix: ${result.price}€`);
    }
    if (result.resultsFile) {
      console.log(`   Fichier: ${result.resultsFile}`);
    }
  } else {
    console.log('❌ SCRAPING ÉCHOUÉ');
    console.log(`   Erreur: ${result.error}`);
    if (result.errorFile) {
      console.log(`   Fichier d'erreur: ${result.errorFile}`);
    }
  }
  console.log('═'.repeat(60));
  process.exit(result.success ? 0 : 1);
});
