/**
 * BACKUP - NE PAS MODIFIER SAUF INSTRUCTION EXPLICITE
 * Ce script fonctionne parfaitement jusqu'au clic sur "Continuer"
 * 
 * Usage: node test_plate_input_only_backup.js [plaque] [url]
 * Exemple: node test_plate_input_only_backup.js CC368ER https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere
 */

const { webkit, chromium } = require('playwright');

async function testPlateInputOnly(plate, url) {
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
    
    // Attendre que la page suivante se charge complètement
    console.log('   ⏳ Attente du chargement de la page suivante...');
    await page.waitForTimeout(5000); // Attente initiale
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
      console.log('   ⚠️  networkidle timeout, continuation...');
    });
    await page.waitForTimeout(3000); // Attente supplémentaire pour être sûr
    console.log('   ✅ Navigation vers la page suivante...');

    // Prendre une capture d'écran
    await page.screenshot({ path: `test_plate_input_${plate}.png`, fullPage: true });
    console.log(`📸 Capture d'écran: test_plate_input_${plate}.png`);

    // Garder ouvert pour voir le résultat
    console.log('\n⏳ Navigateur restera ouvert pour vérification...');
    console.log('   💡 Fermez manuellement le navigateur quand vous avez terminé');
    console.log('   💡 Ou appuyez sur Ctrl+C dans le terminal pour arrêter le script');
    
    // Attendre indéfiniment (ou jusqu'à Ctrl+C)
    return new Promise((resolve) => {
      // Ne pas fermer le navigateur, juste retourner le résultat
      resolve({ success: true, finalValue, browser });
    });

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

    console.log('\n⏳ Navigateur restera ouvert pour vérification...');
    console.log('   💡 Fermez manuellement le navigateur quand vous avez terminé');
    
    // Ne pas fermer le navigateur en cas d'erreur non plus
    return { success: false, error: error.message, browser };
  }
}

// Exécution
const args = process.argv.slice(2);
const PLATE = args[0] || 'CC368ER';
const URL = args[1] || 'https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere';

console.log('🚀 LANCEMENT DU TEST');
console.log('');

testPlateInputOnly(PLATE, URL).then(result => {
  console.log('\n' + '═'.repeat(60));
  if (result.success) {
    console.log('✅ TEST RÉUSSI');
    console.log(`   Plaque finale: "${result.finalValue}"`);
  } else {
    console.log('❌ TEST ÉCHOUÉ');
    console.log(`   Erreur: ${result.error}`);
  }
  console.log('═'.repeat(60));
  console.log('\n💡 Le navigateur reste ouvert pour vérification');
  console.log('💡 Appuyez sur Ctrl+C pour arrêter le script');
  console.log('');
  
  // Ne pas fermer le navigateur, attendre indéfiniment
  // L'utilisateur fermera manuellement ou utilisera Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Arrêt du script...');
    if (result.browser) {
      await result.browser.close();
    }
    process.exit(0);
  });
  
  // Garder le processus en vie
  setInterval(() => {}, 1000);
});

