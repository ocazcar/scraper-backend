/**
 * Script de test avec Playwright (support Safari WebKit)
 * Usage: node test_midas_playwright.js [plaque] [service]
 */

const { chromium, webkit } = require('playwright');

const args = process.argv.slice(2);
const plate = args[0] || 'AB-123-CD';
const service = args[1] || 'plaquettes-avant';

console.log('🧪 Test de scraping Midas avec Playwright (Safari WebKit)');
console.log(`📋 Plaque: ${plate}`);
console.log(`🔧 Service: ${service}`);
console.log('');

async function scrapeMidasDevis(plate, service) {
  let browser = null;
  
  try {
    console.log('🚀 Lancement du navigateur Safari WebKit...');
    
    // Utiliser WebKit (Safari) si disponible, sinon Chromium
    try {
      browser = await webkit.launch({
        headless: false,
      });
      console.log('   ✅ Safari WebKit lancé');
    } catch (webkitError) {
      console.log('   ⚠️  WebKit non disponible, utilisation de Chromium');
      browser = await chromium.launch({
        headless: false,
      });
    }
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    
    const page = await context.newPage();
    
    // Étape 1: Aller sur la page de devis
    const devisUrl = 'https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere';
    console.log(`📍 Étape 1: Navigation vers ${devisUrl}`);
    await page.goto(devisUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Étape 2: Accepter les cookies
    console.log('🍪 Étape 2: Acceptation des cookies...');
    await page.waitForTimeout(2000);
    
    try {
      // Chercher le bouton "Accepter et continuer" (bouton jaune)
      const acceptButton = await page.locator('button:has-text("Accepter et continuer"), button:has-text("Accepter"), button:has-text("J\'accepte")').first();
      if (await acceptButton.isVisible({ timeout: 3000 })) {
        await acceptButton.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ Cookies acceptés ("Accepter et continuer" cliqué)');
      } else {
        console.log('   ℹ️  Pas de popup cookie trouvée');
      }
    } catch (e) {
      console.log('   ℹ️  Pas de popup cookie ou déjà acceptée');
    }
    
    // Étape 3: Trouver le champ qui contient "AB123CD" (valeur par défaut)
    console.log('🚗 Étape 3: Recherche du champ avec "AB123CD"...');
    await page.waitForTimeout(2000);
    
    let plateFieldFound = false;
    let plateInput = null;
    
    // Méthode 1: Chercher dans la section "Mon numéro de plaque" ou "IMMATRICULATION"
    try {
      // Chercher la section avec le texte "Mon numéro de plaque"
      const plateSection = await page.locator('text="Mon numéro de plaque"').first();
      if (await plateSection.isVisible({ timeout: 2000 })) {
        console.log('   ✅ Section "Mon numéro de plaque" trouvée');
        
        // Chercher l'input dans cette section ou juste après
        // L'input est généralement dans le même conteneur ou juste après le texte
        const nearbyInput = await plateSection.locator('..').locator('input').first();
        if (await nearbyInput.isVisible({ timeout: 1000 })) {
          const value = await nearbyInput.inputValue() || '';
          if (value.includes('AB123CD') || value.includes('AB-123-CD')) {
            plateInput = nearbyInput;
            plateFieldFound = true;
            console.log(`   ✅ Champ trouvé dans la section (valeur: "${value}")`);
          }
        }
      }
    } catch (e) {
      console.log('   ℹ️  Section "Mon numéro de plaque" non trouvée, recherche directe...');
    }
    
    // Méthode 2: Chercher directement tous les inputs avec "AB123CD"
    if (!plateFieldFound) {
      try {
        const allInputs = await page.locator('input[type="text"], input[type="search"], input').all();
        console.log(`   🔍 ${allInputs.length} champs input trouvés, recherche de celui avec "AB123CD"...`);
        
        for (const input of allInputs) {
          try {
            const isVisible = await input.isVisible();
            if (!isVisible) continue;
            
            // Récupérer la valeur actuelle du champ
            const value = await input.inputValue() || '';
            
            // Vérifier si le champ contient "AB123CD" (avec ou sans espaces/tirets)
            const normalizedValue = value.replace(/[\s-]/g, '').toUpperCase();
            if (normalizedValue === 'AB123CD' || value.includes('AB123CD') || value.includes('AB-123-CD') || value === 'AB123CD') {
              plateInput = input;
              plateFieldFound = true;
              console.log(`   ✅ Champ trouvé avec la valeur "${value}"`);
              break;
            }
          } catch (e) {
            // Continuer avec le prochain input
          }
        }
      } catch (e) {
        console.log(`   ❌ Erreur lors de la recherche: ${e.message}`);
      }
    }
    
    // Méthode 3: Fallback - chercher par placeholder ou dans la section IMMATRICULATION
    if (!plateFieldFound) {
      console.log('   ⚠️  Champ avec "AB123CD" non trouvé, recherche alternative...');
      try {
        // Chercher dans la section "IMMATRICULATION"
        const immatSection = await page.locator('text="IMMATRICULATION"').first();
        if (await immatSection.isVisible({ timeout: 2000 })) {
          const sectionInput = await immatSection.locator('..').locator('input').first();
          if (await sectionInput.isVisible({ timeout: 1000 })) {
            plateInput = sectionInput;
            plateFieldFound = true;
            console.log('   ✅ Champ trouvé dans la section IMMATRICULATION');
          }
        }
      } catch (e) {
        // Continuer
      }
    }
    
    // Étape 4: Cliquer sur le champ, vider, et entrer la plaque
    if (plateFieldFound && plateInput) {
      console.log(`✏️  Étape 4: Clic sur le champ et saisie de la plaque "${plate}"...`);
      
      try {
        // Cliquer sur le champ pour le sélectionner
        await plateInput.click();
        await page.waitForTimeout(500);
        console.log('   ✅ Champ cliqué');
        
        // Sélectionner tout le texte (triple clic ou Cmd+A)
        await plateInput.click({ clickCount: 3 });
        await page.waitForTimeout(300);
        
        // Vider le champ
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);
        
        // Taper la plaque
        await plateInput.fill(plate);
        await page.waitForTimeout(1000);
        console.log(`   ✅ Plaque "${plate}" saisie`);
        
        // Vérifier que la plaque a bien été saisie
        const newValue = await plateInput.inputValue();
        if (newValue === plate.replace(/[^A-Z0-9]/g, '').toUpperCase() || newValue === plate) {
          console.log(`   ✅ Vérification: plaque "${newValue}" bien saisie`);
        } else {
          console.log(`   ⚠️  Attention: plaque saisie "${newValue}" ne correspond pas à "${plate}"`);
        }
        
      } catch (e) {
        console.log(`   ❌ Erreur lors de la saisie: ${e.message}`);
        plateFieldFound = false;
      }
    } else {
      console.log('   ❌ Impossible de trouver le champ "Mon numéro de plaque"');
      await page.screenshot({ path: 'midas_debug_no_plate_field.png', fullPage: true });
      console.log('   📸 Capture d\'écran: midas_debug_no_plate_field.png');
    }
    
    // Étape 5: Cliquer sur "Continuer" (seulement si la plaque a été saisie)
    if (plateFieldFound) {
      console.log('➡️  Étape 5: Recherche du bouton "Continuer"...');
      await page.waitForTimeout(1500); // Attendre un peu pour que la saisie soit bien prise en compte
      
      try {
        // Chercher le bouton "Continuer" - il peut être à côté du champ plaque dans le footer
        const continueButton = await page.locator('button, [type="submit"], [role="button"], a')
          .filter({ hasText: /continuer|valider|suivant|rechercher/i })
          .first();
        
        if (await continueButton.isVisible({ timeout: 3000 })) {
          // Scroller pour s'assurer que le bouton est visible
          await continueButton.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          
          // Vérifier une dernière fois que la plaque est bien saisie
          if (plateInput) {
            const currentValue = await plateInput.inputValue();
            if (currentValue && currentValue.length > 0) {
              await continueButton.click();
              console.log('   ✅ Bouton "Continuer" cliqué (plaque vérifiée)');
              await page.waitForTimeout(4000); // Attendre le chargement de la page suivante
            } else {
              console.log('   ⚠️  Plaque non saisie, impossible de continuer');
            }
          } else {
            await continueButton.click();
            console.log('   ✅ Bouton "Continuer" cliqué');
            await page.waitForTimeout(4000);
          }
        } else {
          console.log('   ⚠️  Bouton "Continuer" non trouvé');
          // Essayer Entrée comme fallback
          try {
            await page.keyboard.press('Enter');
            await page.waitForTimeout(3000);
            console.log('   ℹ️  Touche Entrée pressée');
          } catch (e) {
            // Ignorer
          }
        }
      } catch (e) {
        console.log(`   ⚠️  Erreur lors de la recherche du bouton: ${e.message}`);
      }
    } else {
      console.log('   ⏭️  Étape 5 ignorée (plaque non saisie)');
    }
    
    await page.screenshot({ path: 'midas_after_plate.png', fullPage: true });
    console.log('📸 Capture: midas_after_plate.png');
    
    // Étape 6: Sélectionner le service
    console.log(`🔧 Étape 6: Sélection du service "${service}"...`);
    await page.waitForTimeout(2000);
    
    const serviceText = service.includes('avant') ? 'Plaquettes avant' : 
                       service.includes('arriere') || service.includes('arrière') ? 'Plaquettes arrière' :
                       'Plaquettes avant';
    
    try {
      const serviceButton = await page.locator('button, a, [role="button"]')
        .filter({ hasText: new RegExp(serviceText, 'i') })
        .first();
      
      if (await serviceButton.isVisible({ timeout: 3000 })) {
        await serviceButton.click();
        await page.waitForTimeout(1500);
        console.log(`   ✅ Service "${serviceText}" sélectionné`);
      }
    } catch (e) {
      console.log(`   ⚠️  Service "${serviceText}" non trouvé`);
    }
    
    // Étape 7: Calculer le devis
    console.log('💰 Étape 7: Recherche du bouton "Calculer mon devis"...');
    await page.waitForTimeout(1000);
    
    try {
      const calculateButton = await page.locator('button, [type="submit"]')
        .filter({ hasText: /calculer|devis/i })
        .first();
      
      if (await calculateButton.isVisible({ timeout: 3000 })) {
        await calculateButton.click();
        console.log('   ✅ Bouton "Calculer mon devis" cliqué');
        await page.waitForTimeout(5000);
      }
    } catch (e) {
      console.log('   ⚠️  Bouton "Calculer mon devis" non trouvé');
    }
    
    await page.screenshot({ path: 'midas_devis_result.png', fullPage: true });
    console.log('📸 Capture du devis: midas_devis_result.png');
    
    // Étape 8: Extraire le prix
    console.log('💶 Étape 8: Extraction du prix...');
    
    const pageText = await page.textContent('body');
    const priceMatches = pageText.match(/(\d+[.,]\d+)\s*€/g);
    
    let price = null;
    if (priceMatches && priceMatches.length > 0) {
      const lastPrice = priceMatches[priceMatches.length - 1].match(/(\d+[.,]\d+)/);
      if (lastPrice) {
        price = parseFloat(lastPrice[1].replace(',', '.'));
        console.log(`   ✅ Prix trouvé: ${price}€`);
      }
    }
    
    console.log('');
    console.log('═'.repeat(50));
    
    if (price) {
      console.log('✅ TEST RÉUSSI !');
      console.log(`   Prix: ${price}€`);
      return { success: true, price, priceWithInstallation: price, url: page.url() };
    } else {
      console.log('❌ TEST ÉCHOUÉ - Prix non trouvé');
      return { success: false, error: 'Prix non trouvé' };
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      console.log('');
      console.log('⏳ Fermeture dans 10 secondes...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
    }
  }
}

(async () => {
  const result = await scrapeMidasDevis(plate, service);
  process.exit(result.success ? 0 : 1);
})();

