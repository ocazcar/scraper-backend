/**
 * Script de test pour vérifier si le scraping Midas fonctionne
 * Suit le processus de devis interactif sur Midas
 * Usage: node test_midas_scraper.js [plaque] [service]
 * Exemple: node test_midas_scraper.js AB-123-CD plaquettes-avant
 */

const puppeteer = require('puppeteer');

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);
const plate = args[0] || 'AB-123-CD'; // Plaque par défaut
const service = args[1] || 'plaquettes-avant'; // Service par défaut

console.log('🧪 Test de scraping Midas (processus de devis)');
console.log(`📋 Plaque: ${plate}`);
console.log(`🔧 Service: ${service}`);
console.log('');

/**
 * Récupère les infos du véhicule depuis l'API de plaque (optionnel, juste pour info)
 */
async function getVehicleInfo(plate) {
  try {
    const token = process.env.VITE_PLATE_API_TOKEN || 'TokenDemo2025A';
    const normalizedPlate = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const url = `https://api.apiplaqueimmatriculation.com/plaque?immatriculation=${encodeURIComponent(normalizedPlate)}&token=${encodeURIComponent(token)}&pays=FR`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.code_erreur === 200 && data.data) {
        const vehicle = data.data;
        console.log(`✅ Véhicule: ${vehicle.marque} ${vehicle.modele || vehicle.modele_en || ''}`);
        return true;
      }
    }
  } catch (error) {
    // Pas grave si ça échoue
  }
  return false;
}

/**
 * Scrape le prix depuis Midas en suivant le processus de devis
 */
async function scrapeMidasDevis(plate, service) {
  let browser = null;
  
  try {
    console.log('🚀 Lancement du navigateur Safari...');
    
    // Essayer d'utiliser Safari si disponible, sinon Chrome
    let browser;
    try {
      // Safari via SafariDriver (nécessite: sudo safaridriver --enable)
      browser = await puppeteer.launch({
        headless: false,
        product: 'safari', // Utiliser Safari
        executablePath: '/usr/bin/safaridriver', // Chemin SafariDriver
      });
      console.log('   ✅ Safari lancé');
    } catch (safariError) {
      console.log('   ⚠️  Safari non disponible, utilisation de Chrome');
      // Fallback sur Chrome
      browser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });
    }
    
    const page = await browser.newPage();
    
    // Masquer les signes d'automatisation
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // User-agent réaliste
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Étape 1: Aller sur la page de devis
    const devisUrl = 'https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere';
    console.log(`📍 Étape 1: Navigation vers ${devisUrl}`);
    await page.goto(devisUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Étape 2: Accepter les cookies
    console.log('🍪 Étape 2: Acceptation des cookies...');
    const cookieSelectors = [
      'button[id*="cookie"]',
      'button[class*="cookie"]',
      'button:has-text("Accepter")',
      'button:has-text("J\'accepte")',
      'button:has-text("OK")',
      '[id*="accept"]',
      '[class*="accept-cookie"]',
      '[class*="cookie-accept"]',
    ];
    
    let cookiesAccepted = false;
    for (const selector of cookieSelectors) {
      try {
        const cookieButton = await page.$(selector);
        if (cookieButton) {
          await cookieButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          cookiesAccepted = true;
          console.log('   ✅ Cookies acceptés');
          break;
        }
      } catch (e) {
        // Continuer
      }
    }
    
    if (!cookiesAccepted) {
      console.log('   ℹ️  Pas de popup cookie trouvée');
    }
    
    // Étape 3: Cliquer sur "Modifier" pour changer la plaque
    console.log('✏️  Étape 3: Recherche du bouton "Modifier"...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Plus de temps pour le chargement
    
    // Chercher tous les boutons et liens qui contiennent "Modifier"
    const modifySelectors = [
      'button',
      'a',
      '[role="button"]',
      '[class*="button"]',
      '[class*="btn"]',
    ];
    
    let modifyClicked = false;
    
    // Chercher par texte dans tous les éléments cliquables
    try {
      const allClickable = await page.$$('button, a, [role="button"]');
      for (const element of allClickable) {
        try {
          const text = await page.evaluate((el) => el.textContent?.trim(), element);
          if (text && (text.toLowerCase().includes('modifier') || text.toLowerCase().includes('changer'))) {
            await element.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            modifyClicked = true;
            console.log(`   ✅ Bouton "Modifier" cliqué (texte: "${text}")`);
            break;
          }
        } catch (e) {
          // Continuer
        }
      }
    } catch (e) {
      console.log('   ⚠️  Erreur lors de la recherche du bouton Modifier');
    }
    
    if (!modifyClicked) {
      console.log('   ℹ️  Bouton "Modifier" non trouvé, peut-être que le champ est déjà vide ou accessible');
    }
    
    // Étape 4: Entrer le numéro de plaque
    console.log(`🚗 Étape 4: Saisie de la plaque "${plate}"...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let plateEntered = false;
    
    // Chercher tous les inputs sur la page
    try {
      const allInputs = await page.$$('input[type="text"], input[type="search"], input:not([type="hidden"])');
      console.log(`   🔍 ${allInputs.length} champs input trouvés`);
      
      for (const input of allInputs) {
        try {
          const placeholder = await page.evaluate((el) => el.placeholder || '', input);
          const name = await page.evaluate((el) => el.name || '', input);
          const id = await page.evaluate((el) => el.id || '', input);
          const value = await page.evaluate((el) => el.value || '', input);
          const ariaLabel = await page.evaluate((el) => el.getAttribute('aria-label') || '', input);
          
          // Vérifier si c'est le champ plaque (plusieurs critères)
          const isPlateField = 
            placeholder.toLowerCase().includes('plaque') ||
            placeholder.toLowerCase().includes('immatriculation') ||
            name.toLowerCase().includes('plate') ||
            name.toLowerCase().includes('immatriculation') ||
            id.toLowerCase().includes('plate') ||
            id.toLowerCase().includes('immatriculation') ||
            ariaLabel.toLowerCase().includes('plaque') ||
            ariaLabel.toLowerCase().includes('immatriculation');
          
          if (isPlateField || (allInputs.length === 1 && !value)) {
            // Vider le champ d'abord
            await input.click({ clickCount: 3 }); // Sélectionner tout
            await new Promise(resolve => setTimeout(resolve, 300));
            await page.keyboard.press('Backspace');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Taper la plaque
            await input.type(plate, { delay: 150 });
            plateEntered = true;
            console.log(`   ✅ Plaque "${plate}" saisie (champ: ${placeholder || name || id || 'sans label'})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          }
        } catch (e) {
          // Continuer avec le prochain input
        }
      }
      
      // Si toujours pas trouvé, essayer le premier input vide
      if (!plateEntered && allInputs.length > 0) {
        try {
          const firstInput = allInputs[0];
          const value = await page.evaluate((el) => el.value || '', firstInput);
          if (!value || value.length < 3) {
            await firstInput.click({ clickCount: 3 });
            await new Promise(resolve => setTimeout(resolve, 300));
            await page.keyboard.press('Backspace');
            await new Promise(resolve => setTimeout(resolve, 300));
            await firstInput.type(plate, { delay: 150 });
            plateEntered = true;
            console.log(`   ✅ Plaque saisie dans le premier champ disponible`);
          }
        } catch (e) {
          console.log(`   ❌ Erreur: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`   ❌ Erreur lors de la recherche des champs: ${e.message}`);
    }
    
    if (!plateEntered) {
      console.log('   ❌ Impossible de trouver et remplir le champ plaque');
      // Prendre une capture d'écran pour debug
      await page.screenshot({ path: 'midas_debug_no_plate_field.png', fullPage: true });
      console.log('   📸 Capture d\'écran de debug: midas_debug_no_plate_field.png');
    }
    
    // Étape 5: Cliquer sur "Continuer"
    if (plateEntered) {
      console.log('➡️  Étape 5: Recherche du bouton "Continuer"...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let continueClicked = false;
      
      // Chercher tous les boutons et liens
      try {
        const allButtons = await page.$$('button, a, [role="button"], [type="submit"], [class*="button"], [class*="btn"]');
        console.log(`   🔍 ${allButtons.length} boutons trouvés`);
        
        for (const button of allButtons) {
          try {
            const text = await page.evaluate((el) => el.textContent?.trim() || el.value?.trim() || '', button);
            const isVisible = await page.evaluate((el) => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
            }, button);
            
            if (isVisible && text && (
              text.toLowerCase().includes('continuer') ||
              text.toLowerCase().includes('valider') ||
              text.toLowerCase().includes('suivant') ||
              text.toLowerCase().includes('rechercher') ||
              text === '→' ||
              text === '>'
            )) {
              await button.scrollIntoView();
              await new Promise(resolve => setTimeout(resolve, 500));
              await button.click();
              console.log(`   ✅ Bouton cliqué: "${text}"`);
              await new Promise(resolve => setTimeout(resolve, 4000)); // Attendre le chargement
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
      
      if (!continueClicked) {
        console.log('   ⚠️  Bouton "Continuer" non trouvé');
        // Essayer d'appuyer sur Entrée dans le champ input
        try {
          await page.keyboard.press('Enter');
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log('   ℹ️  Touche Entrée pressée dans le champ');
        } catch (e) {
          // Ignorer
        }
      }
    } else {
      console.log('   ⏭️  Étape 5 ignorée (plaque non saisie)');
    }
    
    // Prendre une capture d'écran après la saisie de la plaque
    await page.screenshot({ path: 'midas_after_plate.png', fullPage: true });
    console.log('📸 Capture d\'écran: midas_after_plate.png');
    
    // Étape 6: Sélectionner le service (Plaquettes avant ou arrière)
    console.log(`🔧 Étape 6: Sélection du service "${service}"...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const serviceText = service.includes('avant') ? 'Plaquettes avant' : 
                       service.includes('arriere') || service.includes('arrière') ? 'Plaquettes arrière' :
                       'Plaquettes avant'; // Par défaut
    
    const serviceSelectors = [
      `button:has-text("${serviceText}")`,
      `a:has-text("${serviceText}")`,
      `[class*="plaquettes-avant"]`,
      `[class*="plaquettes-arriere"]`,
      `[class*="plaquettes-arrière"]`,
      `[data-service*="avant"]`,
      `[data-service*="arriere"]`,
    ];
    
    let serviceSelected = false;
    for (const selector of serviceSelectors) {
      try {
        const serviceButton = await page.$(selector);
        if (serviceButton) {
          await serviceButton.click();
          await new Promise(resolve => setTimeout(resolve, 1500));
          serviceSelected = true;
          console.log(`   ✅ Service "${serviceText}" sélectionné`);
          break;
        }
      } catch (e) {
        // Continuer
      }
    }
    
    if (!serviceSelected) {
      console.log(`   ⚠️  Bouton "${serviceText}" non trouvé, peut-être déjà sélectionné`);
    }
    
    // Étape 7: Cliquer sur "Calculer mon devis"
    console.log('💰 Étape 7: Recherche du bouton "Calculer mon devis"...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const calculateSelectors = [
      'button:has-text("Calculer mon devis")',
      'button:has-text("Calculer")',
      'button:has-text("Voir le devis")',
      'button[type="submit"]',
      '[class*="calculate"]',
      '[class*="devis"]',
    ];
    
    let calculateClicked = false;
    for (const selector of calculateSelectors) {
      try {
        const calculateButton = await page.$(selector);
        if (calculateButton) {
          const buttonText = await page.evaluate((el) => el.textContent, calculateButton);
          if (buttonText && (buttonText.includes('Calculer') || buttonText.includes('devis'))) {
            await calculateButton.click();
            console.log('   ✅ Bouton "Calculer mon devis" cliqué');
            console.log('   ⏳ Attente du chargement du devis...');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre le chargement du devis
            calculateClicked = true;
            break;
          }
        }
      } catch (e) {
        // Continuer
      }
    }
    
    if (!calculateClicked) {
      console.log('   ⚠️  Bouton "Calculer mon devis" non trouvé');
    }
    
    // Prendre une capture d'écran du devis
    await page.screenshot({ path: 'midas_devis_result.png', fullPage: true });
    console.log('📸 Capture d\'écran du devis: midas_devis_result.png');
    
    // Étape 8: Extraire le prix
    console.log('💶 Étape 8: Extraction du prix...');
    
    const priceSelectors = [
      '[class*="price"]',
      '[class*="prix"]',
      '[class*="total"]',
      '[data-price]',
      '[class*="amount"]',
      '[class*="devis-price"]',
      '[class*="quote-price"]',
    ];
    
    let price = null;
    let priceText = null;
    
    for (const selector of priceSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate((el) => el.textContent, element);
          const match = text.match(/(\d+[.,]\d+)\s*€/);
          if (match) {
            const candidatePrice = parseFloat(match[1].replace(',', '.'));
            // Prendre le prix le plus élevé (généralement le total)
            if (!price || candidatePrice > price) {
              price = candidatePrice;
              priceText = text.trim();
            }
          }
        }
      } catch (e) {
        // Continuer
      }
    }
    
    // Si pas de prix trouvé, chercher dans tout le texte
    if (!price) {
      const pageText = await page.evaluate(() => document.body.textContent);
      const priceMatches = pageText.match(/(\d+[.,]\d+)\s*€/g);
      if (priceMatches && priceMatches.length > 0) {
        // Prendre le dernier prix trouvé (généralement le total)
        const lastPrice = priceMatches[priceMatches.length - 1].match(/(\d+[.,]\d+)/);
        if (lastPrice) {
          price = parseFloat(lastPrice[1].replace(',', '.'));
          priceText = priceMatches[priceMatches.length - 1];
        }
      }
    }
    
    // Résultat
    console.log('');
    console.log('═'.repeat(50));
    
    if (price) {
      console.log('✅ TEST RÉUSSI !');
      console.log(`   Prix trouvé: ${price}€`);
      console.log(`   URL: ${page.url()}`);
      return {
        success: true,
        price,
        priceWithInstallation: price, // Le prix affiché inclut déjà l'installation
        url: page.url(),
      };
    } else {
      console.log('❌ TEST ÉCHOUÉ');
      console.log('   Aucun prix trouvé sur la page');
      console.log('   💡 Vérifiez les captures d\'écran pour voir ce qui s\'est passé');
      return {
        success: false,
        error: 'Prix non trouvé',
      };
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du scraping:', error.message);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (browser) {
      console.log('');
      console.log('⏳ Fermeture du navigateur dans 10 secondes...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
    }
  }
}

// Fonction principale
(async () => {
  try {
    console.log('═'.repeat(50));
    console.log('🧪 TEST DE SCRAPING MIDAS (PROCESSUS DEVIS)');
    console.log('═'.repeat(50));
    console.log('');
    
    // Optionnel: récupérer les infos du véhicule
    await getVehicleInfo(plate);
    console.log('');
    
    // Scraper Midas
    const result = await scrapeMidasDevis(plate, service);
    
    console.log('');
    console.log('═'.repeat(50));
    if (result.success) {
      console.log('✅ TEST RÉUSSI !');
      console.log(`   Prix: ${result.price}€`);
      console.log(`   Prix avec installation: ${result.priceWithInstallation}€`);
    } else {
      console.log('❌ TEST ÉCHOUÉ');
      console.log(`   Erreur: ${result.error}`);
    }
    console.log('═'.repeat(50));
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
})();
