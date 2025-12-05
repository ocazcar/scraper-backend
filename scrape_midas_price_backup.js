/**
 * FONCTION BACKUP - NE PAS MODIFIER
 * Cette fonction fonctionne parfaitement et est sauvegardée ici comme référence
 * 
 * Fonction générique pour scraper un prix Midas
 * @param {string} plate - Numéro de plaque d'immatriculation
 * @param {Object|null} serviceConfig - Configuration du service (null si pas de sélection)
 * @param {string} serviceConfig.midasUrl - URL Midas du service
 * @param {boolean} serviceConfig.hasSelection - Si le service nécessite une sélection
 * @param {string} serviceConfig.midasService - Identifiant du service (ex: "plaquettes-avant")
 * @param {Array} serviceConfig.selectionOptions - Options de sélection disponibles
 * @param {string} serviceConfig.selectionType - Type de sélection (plaquettes, disques, etc.)
 * @returns {Promise<Object>} Résultat avec success, price, url, etc.
 */

const { chromium, webkit } = require('playwright');

async function scrapeMidasPrice(plate, serviceConfig = null) {
  let browser = null;
  let context = null;

  try {
    // Si pas de config, on ne peut pas scraper
    if (!serviceConfig || !serviceConfig.midasUrl) {
      return { success: false, error: 'Configuration du service manquante' };
    }

    // Lancer le navigateur (comme dans la version qui fonctionnait)
    try {
      browser = await webkit.launch({ headless: false });
      console.log('   ✅ Safari WebKit lancé');
    } catch (webkitError) {
      console.log('   ⚠️  WebKit non disponible, utilisation de Chromium');
      browser = await chromium.launch({ headless: false });
    }
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    const page = await context.newPage();

    // Étape 1: Aller sur la page de devis
    console.log(`📍 Navigation vers: ${serviceConfig.midasUrl}`);
    await page.goto(serviceConfig.midasUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Étape 2: Accepter les cookies (comme dans la version qui fonctionnait)
    console.log('🍪 Acceptation des cookies...');
    try {
      const acceptButton = await page.locator('button:has-text("Accepter et continuer")').first();
      if (await acceptButton.isVisible({ timeout: 3000 })) {
        await acceptButton.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ Cookies acceptés');
      }
    } catch (e) {
      console.log('   ℹ️  Pas de popup cookie');
    }

    // Étape 3: Trouver et remplir le champ plaque (logique qui fonctionnait)
    console.log('🔍 Localisation du champ avec "AB123CD"...');
    await page.waitForTimeout(2000);
    
    let plateInput = null;
    
    // Méthode 1: Chercher par placeholder
    try {
      const inputByPlaceholder = await page.locator('input[placeholder*="AB123CD"]').first();
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
        const plateSection = await page.locator('text="Mon numéro de plaque"').first();
        if (await plateSection.isVisible({ timeout: 2000 })) {
          console.log('   ✅ Section "Mon numéro de plaque" trouvée');
          
          const sectionInput = await plateSection.locator('..').locator('input').first();
          if (await sectionInput.isVisible({ timeout: 1000 })) {
            const value = await sectionInput.inputValue() || '';
            if (value.includes('AB123CD') || value.includes('AB-123-CD')) {
              plateInput = sectionInput;
              console.log(`   ✅ Champ trouvé dans la section (valeur: "${value}")`);
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
        console.log(`   🔍 ${allInputs.length} champs trouvés, recherche de celui avec "AB123CD"...`);
        
        for (const input of allInputs) {
          try {
            const isVisible = await input.isVisible();
            if (!isVisible) continue;
            
            const value = await input.inputValue() || '';
            const normalizedValue = value.replace(/[\s-]/g, '').toUpperCase();
            
            if (normalizedValue === 'AB123CD' || value.includes('AB123CD') || value.includes('AB-123-CD')) {
              plateInput = input;
              console.log(`   ✅ Champ trouvé avec la valeur "${value}"`);
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
    console.log('👆 Clic sur le champ...');
    await plateInput.click();
    await page.waitForTimeout(500);
    await plateInput.focus();
    await page.waitForTimeout(300);
    console.log('   ✅ Champ cliqué et focus');
    
    // Étape 5: Vider le champ avec Ctrl+A puis Delete (méthode plus humaine)
    console.log('🗑️  Vidage du champ...');
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    
    const valueAfterClear = await plateInput.inputValue() || '';
    if (valueAfterClear.length > 0) {
      // Si ça n'a pas marché, essayer avec Backspace
      await plateInput.click({ clickCount: 3 });
      await page.waitForTimeout(200);
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(200);
    }
    console.log('   ✅ Champ vidé');
    
    // Étape 6: Taper la plaque avec le clavier (simulation plus humaine)
    console.log(`⌨️  Saisie de la plaque "${plate}" avec le clavier...`);
    await plateInput.focus();
    await page.waitForTimeout(200);
    
    // Utiliser keyboard.type() au lieu de input.type() pour simuler un vrai clavier
    for (let i = 0; i < plate.length; i++) {
      await page.keyboard.type(plate[i], { delay: 80 + Math.random() * 40 }); // Délai variable 80-120ms
      await page.waitForTimeout(50 + Math.random() * 50); // Petite pause aléatoire
    }
    await page.waitForTimeout(800);
    console.log(`   ✅ Plaque "${plate}" saisie`);
    
    // Étape 7: Déclencher tous les événements possibles (comme un vrai utilisateur)
    console.log('📡 Déclenchement des événements...');
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
    await page.waitForTimeout(1000);
    console.log('   ✅ Événements déclenchés');
    
    // Vérifier la valeur finale
    const finalValue = await plateInput.inputValue() || '';
    console.log(`   📋 Valeur finale dans le champ: "${finalValue}"`);
    
    if (finalValue !== plate && finalValue.replace(/[\s-]/g, '').toUpperCase() !== plate.replace(/[\s-]/g, '').toUpperCase()) {
      throw new Error(`La plaque ne correspond pas: attendu "${plate}", obtenu "${finalValue}"`);
    }
    
    console.log('   ✅ La plaque correspond !');

    // Étape 8: Cliquer sur "Continuer" (logique qui fonctionnait)
    console.log('➡️  Recherche du bouton "Continuer"...');
    await page.waitForTimeout(1000);
    
    let continueClicked = false;
    
    try {
      const continueButton = await page.locator('button, [type="submit"], [role="button"], a')
        .filter({ hasText: /continuer/i })
        .first();
      
      if (await continueButton.isVisible({ timeout: 3000 })) {
        await continueButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        
        const buttonText = await continueButton.textContent();
        console.log(`   🔍 Bouton trouvé: "${buttonText?.trim()}"`);
        
        await continueButton.click();
        console.log('   ✅ Bouton "Continuer" cliqué');
        await page.waitForTimeout(4000);
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
              await page.waitForTimeout(500);
              await button.click();
              console.log(`   ✅ Bouton "Continuer" cliqué (texte: "${text.trim()}")`);
              await page.waitForTimeout(4000);
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
      throw new Error('Bouton Continuer non cliqué');
    }

    // Étape 6: Sélectionner le service (SEULEMENT si hasSelection === true)
    if (serviceConfig.hasSelection) {
      console.log('🔧 Sélection du service...');
      await page.waitForTimeout(5000);
      await page.waitForTimeout(2000);

      const allClickable = await page.locator('button, a, [role="button"], [class*="button"], div[class*="selectable"], div[class*="option"], div[class*="card"], div[class*="choice"]').all();
      const allDivs = await page.locator('div, span, p, li, td, label').all();
      const allElements = [...allClickable, ...allDivs];

      // Déterminer quelle option sélectionner selon le service
      const serviceId = serviceConfig.midasService;
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
          targetSelection = 'Balai avant côté conducteur'; // "Balai" sans "s"
        } else if (serviceId.includes('passager')) {
          targetSelection = 'Balai avant côté passager'; // "Balai" sans "s"
        } else if (serviceId.includes('tous')) {
          targetSelection = 'Tous';
        }
      } else if (serviceConfig.selectionType === 'batterie') {
        // Pour la batterie, on prendra la première option par défaut
        // On pourra l'améliorer plus tard
        targetSelection = 'Je n\'ai pas le start & stop'; // Avec "&" et non "and"
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
                // Pour "Les deux", on cherche juste un élément qui contient "les deux"
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
                // Pour "Les deux", on cherche juste un élément qui contient "les deux"
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
                // Pour "Les deux", on cherche juste un élément qui contient "les deux"
                containerElement = allElements[i];
                break;
              }
            } else if (serviceConfig.selectionType === 'balais') {
              // Chercher "balai" (sans "s") pour les balais
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
              // Pour la batterie, chercher avec "&" ou "and"
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
    }

    // Étape 7: Cliquer sur "Je calcule mon devis"
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

    // Étape 8: Extraire le prix
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
      const pageText = await page.textContent();
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
      await browser.close();
    }
  }
}

module.exports = { scrapeMidasPrice };

