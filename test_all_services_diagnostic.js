/**
 * Script de diagnostic pour tester tous les services Midas
 * Objectif : Identifier quels services fonctionnent encore et lesquels sont bloqués
 * 
 * Usage: node test_all_services_diagnostic.js [plaque]
 * Exemple: node test_all_services_diagnostic.js GH878CD
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Charger la configuration des services
const servicesConfigData = JSON.parse(fs.readFileSync(path.join(__dirname, 'services_config.json'), 'utf8'));
const servicesConfig = servicesConfigData.services || servicesConfigData; // Support des deux formats

async function testService(browser, plate, serviceId, serviceConfig) {
  const page = await browser.newPage();
  
  try {
    console.log(`\n🔍 Test: ${serviceId}`);
    console.log(`   URL: ${serviceConfig.midasUrl}`);
    
    // Options stealth
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
      window.chrome = { runtime: {} };
    });
    
    // Aller sur la page
    await page.goto(serviceConfig.midasUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Accepter les cookies
    try {
      const acceptButton = await page.locator('button:has-text("Accepter"), button:has-text("accepter")').first();
      if (await acceptButton.isVisible({ timeout: 2000 })) {
        await acceptButton.click();
        await page.waitForTimeout(1500);
      }
    } catch (e) {
      // Pas de cookies
    }
    
    // Trouver le champ plaque
    let plateInput = null;
    try {
      plateInput = await page.locator('input[placeholder*="AB"], input[placeholder*="ab"], input[placeholder*="123"]').first();
      if (!(await plateInput.isVisible({ timeout: 3000 }))) {
        // Chercher autrement
        const allInputs = await page.locator('input[type="text"], input[type="search"]').all();
        for (const input of allInputs) {
          const placeholder = await input.getAttribute('placeholder') || '';
          if (placeholder.match(/AB|123|plaque/i)) {
            plateInput = input;
            break;
          }
        }
      }
    } catch (e) {
      return {
        serviceId,
        success: false,
        error: 'Champ plaque non trouvé',
        step: 'recherche_champ'
      };
    }
    
    if (!plateInput) {
      return {
        serviceId,
        success: false,
        error: 'Champ plaque non trouvé',
        step: 'recherche_champ'
      };
    }
    
    // Saisir la plaque
    await plateInput.click();
    await page.waitForTimeout(500);
    await plateInput.fill(plate);
    await page.waitForTimeout(1000);
    
    // Déclencher les événements
    await page.evaluate((input) => {
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }, await plateInput.elementHandle());
    
    await page.waitForTimeout(3000);
    
    // Vérifier s'il y a une erreur
    const errorMessages = await page.locator('text=/erreur|error|invalide|non reconnu|bloqué|blocked|détecté/i').all();
    if (errorMessages.length > 0) {
      const errorTexts = [];
      for (const errorMsg of errorMessages) {
        const text = await errorMsg.textContent();
        if (text && text.trim().length > 0) {
          errorTexts.push(text.trim());
        }
      }
      if (errorTexts.length > 0) {
        // Prendre une capture d'écran
        await page.screenshot({ path: `error_${serviceId}.png`, fullPage: true });
        return {
          serviceId,
          success: false,
          error: `Erreur détectée: ${errorTexts.join(', ')}`,
          step: 'saisie_plaque',
          screenshot: `error_${serviceId}.png`
        };
      }
    }
    
    // Chercher et cliquer sur "Continuer"
    let continueButton = null;
    try {
      continueButton = await page.locator('button, [type="submit"], [role="button"], a')
        .filter({ hasText: /continuer|CONTINUER/i })
        .first();
      
      if (await continueButton.isVisible({ timeout: 3000 })) {
        await continueButton.click();
        await page.waitForTimeout(3000);
        
        // Vérifier s'il y a une erreur après le clic
        const errorAfterClick = await page.locator('text=/erreur|error|invalide|non reconnu|bloqué|blocked/i').all();
        if (errorAfterClick.length > 0) {
          const errorTexts = [];
          for (const errorMsg of errorAfterClick) {
            const text = await errorMsg.textContent();
            if (text) errorTexts.push(text.trim());
          }
          await page.screenshot({ path: `error_${serviceId}_after_click.png`, fullPage: true });
          return {
            serviceId,
            success: false,
            error: `Erreur après clic: ${errorTexts.join(', ')}`,
            step: 'continuer',
            screenshot: `error_${serviceId}_after_click.png`
          };
        }
        
        console.log('   ✅ Clic sur Continuer réussi, passage à la sélection...');
      } else {
        return {
          serviceId,
          success: false,
          error: 'Bouton Continuer non visible',
          step: 'continuer'
        };
      }
    } catch (e) {
      return {
        serviceId,
        success: false,
        error: `Bouton Continuer non trouvé: ${e.message}`,
        step: 'recherche_bouton'
      };
    }
    
    // Si le service nécessite une sélection, faire la sélection
    if (serviceConfig.hasSelection && serviceConfig.selectionOptions) {
      console.log('   🔍 Recherche de l\'option de sélection...');
      await page.waitForTimeout(3000);
      
      // Déterminer quelle option sélectionner selon le serviceId
      let optionToSelect = null;
      if (serviceId.includes('avant') && !serviceId.includes('arriere') && !serviceId.includes('complet')) {
        // Service "avant" uniquement
        optionToSelect = serviceConfig.selectionOptions.find(opt => 
          opt.toLowerCase().includes('avant') && !opt.toLowerCase().includes('arrière') && !opt.toLowerCase().includes('les deux')
        ) || serviceConfig.selectionOptions[0];
      } else if (serviceId.includes('arriere') && !serviceId.includes('avant') && !serviceId.includes('complet')) {
        // Service "arrière" uniquement
        optionToSelect = serviceConfig.selectionOptions.find(opt => 
          opt.toLowerCase().includes('arrière') && !opt.toLowerCase().includes('avant') && !opt.toLowerCase().includes('les deux')
        ) || serviceConfig.selectionOptions[1];
      } else {
        // Par défaut, prendre la première option
        optionToSelect = serviceConfig.selectionOptions[0];
      }
      
      console.log(`   🎯 Option à sélectionner: "${optionToSelect}"`);
      
      // Chercher et cliquer sur l'option
      try {
        const allClickableElements = await page.locator('button, div[class*="selectable"], div[class*="option"], div[class*="card"], div[class*="choice"], [role="button"]').all();
        let optionFound = false;
        
        for (const element of allClickableElements) {
          try {
            const isVisible = await element.isVisible({ timeout: 500 });
            if (!isVisible) continue;
            
            const text = await element.textContent();
            const trimmedText = text?.trim() || '';
            
            // Vérifier si le texte correspond à l'option recherchée
            if (trimmedText.toLowerCase().includes(optionToSelect.toLowerCase()) || 
                optionToSelect.toLowerCase().includes(trimmedText.toLowerCase().substring(0, 10))) {
              console.log(`   ✅ Option trouvée: "${trimmedText}"`);
              await element.click();
              await page.waitForTimeout(2000);
              optionFound = true;
              break;
            }
          } catch (e) {
            // Continuer
          }
        }
        
        if (!optionFound) {
          return {
            serviceId,
            success: false,
            error: `Option "${optionToSelect}" non trouvée`,
            step: 'selection'
          };
        }
      } catch (e) {
        return {
          serviceId,
          success: false,
          error: `Erreur lors de la sélection: ${e.message}`,
          step: 'selection'
        };
      }
    }
    
    // Chercher et cliquer sur "Je calcule mon devis" ou "Calculer mon devis"
    console.log('   🔍 Recherche du bouton "Je calcule mon devis"...');
    await page.waitForTimeout(2000);
    
    try {
      const calculateButtons = await page.locator('button, [type="submit"], [role="button"], a, div[class*="button"]')
        .filter({ hasText: /calculer|calcule|devis/i })
        .all();
      
      let calculateButtonFound = false;
      for (const btn of calculateButtons) {
        try {
          const isVisible = await btn.isVisible({ timeout: 1000 });
          if (!isVisible) continue;
          
          const text = await btn.textContent();
          if (text && text.toLowerCase().includes('calcul')) {
            console.log(`   ✅ Bouton trouvé: "${text.trim()}"`);
            await btn.click();
            await page.waitForTimeout(5000); // Attendre le chargement du devis
            calculateButtonFound = true;
            break;
          }
        } catch (e) {
          // Continuer
        }
      }
      
      if (!calculateButtonFound) {
        return {
          serviceId,
          success: false,
          error: 'Bouton "Je calcule mon devis" non trouvé',
          step: 'calcul_devis'
        };
      }
    } catch (e) {
      return {
        serviceId,
        success: false,
        error: `Erreur lors de la recherche du bouton calculer: ${e.message}`,
        step: 'calcul_devis'
      };
    }
    
    // Extraire le prix
    console.log('   💰 Extraction du prix...');
    await page.waitForTimeout(3000);
    
    let price = null;
    try {
      // Chercher le prix avec plusieurs sélecteurs
      const priceSelectors = [
        'span[class*="price"]',
        'div[class*="price"]',
        'p[class*="price"]',
        '[class*="prix"]',
        'text=/\\d+[,\\.]\\d+\\s*€/',
        'text=/\\d+\\s*€/'
      ];
      
      for (const selector of priceSelectors) {
        try {
          const priceElements = await page.locator(selector).all();
          for (const elem of priceElements) {
            const text = await elem.textContent();
            if (text) {
              const priceMatch = text.match(/(\d+[,\\.]\d+)\s*€/);
              if (priceMatch) {
                price = priceMatch[1].replace(',', '.');
                console.log(`   ✅ Prix trouvé: ${price}€`);
                break;
              }
            }
          }
          if (price) break;
        } catch (e) {
          // Continuer
        }
      }
      
      // Si pas trouvé, chercher dans tout le texte de la page
      if (!price) {
        const pageText = await page.locator('body').textContent();
        const priceMatch = pageText.match(/(\d+[,\\.]\d+)\s*€/);
        if (priceMatch) {
          price = priceMatch[1].replace(',', '.');
          console.log(`   ✅ Prix trouvé dans le texte: ${price}€`);
        }
      }
    } catch (e) {
      console.log(`   ⚠️  Erreur lors de l'extraction du prix: ${e.message}`);
    }
    
    // Prendre une capture d'écran finale
    await page.screenshot({ path: `result_${serviceId}.png`, fullPage: true });
    
    // Garder le navigateur ouvert 10 secondes pour voir le résultat
    console.log('   ⏳ Attente de 10 secondes pour voir le résultat...');
    await page.waitForTimeout(10000);
    
    if (price) {
      return {
        serviceId,
        success: true,
        message: 'Prix récupéré avec succès',
        step: 'prix_extrait',
        price: parseFloat(price),
        screenshot: `result_${serviceId}.png`
      };
    } else {
      return {
        serviceId,
        success: false,
        error: 'Prix non trouvé sur la page',
        step: 'extraction_prix',
        screenshot: `result_${serviceId}.png`
      };
    }
    
  } catch (error) {
    await page.screenshot({ path: `error_${serviceId}_exception.png`, fullPage: true });
    return {
      serviceId,
      success: false,
      error: error.message,
      step: 'exception',
      screenshot: `error_${serviceId}_exception.png`
    };
  } finally {
    await page.close();
  }
}

async function testAllServices(plate, proxyConfig = null) {
  const results = {
    plate,
    timestamp: new Date().toISOString(),
    total: 0,
    success: 0,
    failed: 0,
    proxyUsed: proxyConfig ? `${proxyConfig.server}:${proxyConfig.port}` : 'Aucun (connexion directe)',
    results: []
  };
  
  // Configuration du navigateur avec proxy si fourni
  const launchOptions = {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  };
  
  // Ajouter les options proxy si fournies
  if (proxyConfig) {
    launchOptions.proxy = {
      server: `${proxyConfig.server}:${proxyConfig.port}`,
      username: proxyConfig.username,
      password: proxyConfig.password
    };
    console.log(`🌐 Utilisation du proxy: ${proxyConfig.server}:${proxyConfig.port}`);
  } else {
    console.log(`🌐 Connexion directe (pas de proxy)`);
  }
  
  const browser = await chromium.launch(launchOptions);
  
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    }
  };
  
  const context = await browser.newContext(contextOptions);
  
  // Filtrer les services à tester (exclure ceux avec skipScraping)
  let servicesToTest = [];
  
  if (Array.isArray(servicesConfig)) {
    // Format tableau
    servicesToTest = servicesConfig
      .filter(config => !config.skipScraping && config.midasUrl)
      .map(config => ({ id: config.id, ...config }));
  } else {
    // Format objet
    servicesToTest = Object.entries(servicesConfig)
      .filter(([id, config]) => !config.skipScraping && config.midasUrl)
      .map(([id, config]) => ({ id, ...config }));
  }
  
  results.total = servicesToTest.length;
  
  console.log('═'.repeat(60));
  console.log(`🧪 TEST DE DIAGNOSTIC - ${results.total} services à tester`);
  console.log(`📋 Plaque: ${plate}`);
  console.log('═'.repeat(60));
  
  // Tester chaque service avec un délai entre chaque
  for (let i = 0; i < servicesToTest.length; i++) {
    const service = servicesToTest[i];
    console.log(`\n[${i + 1}/${results.total}]`);
    
    const result = await testService(browser, plate, service.id, service);
    results.results.push(result);
    
    if (result.success) {
      results.success++;
      console.log(`   ✅ SUCCÈS: ${result.message || 'OK'}`);
    } else {
      results.failed++;
      console.log(`   ❌ ÉCHEC: ${result.error}`);
      console.log(`   📍 Étape: ${result.step}`);
    }
    
    // Délai entre les tests (5 secondes)
    if (i < servicesToTest.length - 1) {
      console.log('   ⏳ Attente de 5 secondes avant le prochain test...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  await browser.close();
  
  // Sauvegarder les résultats
  const resultsFile = `diagnostic_results_${plate}_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(path.join(__dirname, resultsFile), JSON.stringify(results, null, 2));
  
  // Afficher le résumé
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(60));
  console.log(`Total: ${results.total}`);
  console.log(`✅ Succès: ${results.success} (${Math.round(results.success / results.total * 100)}%)`);
  console.log(`❌ Échecs: ${results.failed} (${Math.round(results.failed / results.total * 100)}%)`);
  console.log(`\n📄 Résultats sauvegardés dans: ${resultsFile}`);
  
  // Afficher les services qui fonctionnent
  const workingServices = results.results.filter(r => r.success);
  if (workingServices.length > 0) {
    console.log('\n✅ Services qui fonctionnent:');
    workingServices.forEach(r => console.log(`   • ${r.serviceId}`));
  }
  
  // Afficher les services qui ne fonctionnent pas
  const failedServices = results.results.filter(r => !r.success);
  if (failedServices.length > 0) {
    console.log('\n❌ Services qui ne fonctionnent pas:');
    failedServices.forEach(r => {
      console.log(`   • ${r.serviceId}: ${r.error}`);
    });
  }
  
  return results;
}

// Exécution
const args = process.argv.slice(2);
const PLATE = args[0] || 'GH878CD';

// Support des proxies via variables d'environnement ou arguments
// Format: PROXY_SERVER=host PROXY_PORT=port PROXY_USER=user PROXY_PASS=pass node test_all_services_diagnostic.js GH878CD
// ou: node test_all_services_diagnostic.js GH878CD proxy_host proxy_port [username] [password]
let proxyConfig = null;

if (args[1] && args[2]) {
  // Proxy fourni en arguments
  proxyConfig = {
    server: args[1],
    port: parseInt(args[2]),
    username: args[3] || process.env.PROXY_USER || undefined,
    password: args[4] || process.env.PROXY_PASS || undefined
  };
} else if (process.env.PROXY_SERVER && process.env.PROXY_PORT) {
  // Proxy fourni via variables d'environnement
  proxyConfig = {
    server: process.env.PROXY_SERVER,
    port: parseInt(process.env.PROXY_PORT),
    username: process.env.PROXY_USER || undefined,
    password: process.env.PROXY_PASS || undefined
  };
}

console.log('🚀 LANCEMENT DU DIAGNOSTIC');
console.log(`📋 Plaque: ${PLATE}`);
if (proxyConfig) {
  console.log(`🌐 Proxy: ${proxyConfig.server}:${proxyConfig.port}`);
} else {
  console.log(`🌐 Connexion: Directe (WiFi/4G)`);
  console.log(`💡 Pour tester avec un proxy: PROXY_SERVER=host PROXY_PORT=port node test_all_services_diagnostic.js ${PLATE}`);
  console.log(`💡 Ou changez de connexion (4G) et relancez le script`);
}
console.log('');

testAllServices(PLATE, proxyConfig).then(() => {
  console.log('\n✅ Diagnostic terminé');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

