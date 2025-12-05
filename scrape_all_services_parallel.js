/**
 * Script pour scraper TOUS les prix de TOUTES les prestations en parallèle
 * Utilise la fonction backup pour les services avec sélection
 * Utilise la fonction modifiée pour les services sans sélection
 * 
 * Usage: node scrape_all_services_parallel.js [plaque]
 * Exemple: node scrape_all_services_parallel.js EV404YY
 */

const { scrapeMidasPrice: scrapeMidasPriceBackup } = require('./scrape_midas_price_backup');
const { scrapeMidasPrice: scrapeMidasPriceModified } = require('./scrape_midas_price');
const fs = require('fs');
const path = require('path');

// Charger la configuration
const servicesConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'services_config.json'), 'utf8')
);

// Récupérer la plaque depuis les arguments
const args = process.argv.slice(2);
const PLATE_NUMBER = args[0] || 'EV404YY';

// Filtrer les services à scraper (exclure ceux avec skipScraping)
let servicesToScrape = servicesConfig.services.filter(s => !s.skipScraping);

// Ordre de priorité des services (les plus importants en premier)
const priorityOrder = {
  'plaquettes-avant': 1,
  'plaquettes-arriere': 2,
  'disques-avant': 3,
  'disques-arriere': 4,
  'amortisseurs-avant': 5,
  'amortisseurs-arriere': 6,
  'embrayage': 7,
  'batterie': 8,
  'balais-essuie-glace-conducteur': 9,
  'balais-essuie-glace-passager': 10,
  'courroie-distribution': 11,
  'climatisation': 12
};

// Trier les services par priorité
servicesToScrape = servicesToScrape.sort((a, b) => {
  const priorityA = priorityOrder[a.id] || 999;
  const priorityB = priorityOrder[b.id] || 999;
  return priorityA - priorityB;
});

console.log('🚀 Scraping de TOUS les prix (SÉQUENTIEL par batch de 2)');
console.log(`📋 Plaque: ${PLATE_NUMBER}`);
console.log(`📊 Nombre de services: ${servicesToScrape.length}`);
console.log(`📋 Ordre: ${servicesToScrape.map(s => s.id).join(', ')}`);
console.log('');

/**
 * Fonction pour scraper un service (choisit automatiquement la bonne fonction)
 */
async function scrapeService(plate, service) {
  try {
    console.log(`🔧 [${service.id}] ${service.name}...`);
    
    let result;
    
    // Utiliser la fonction backup si hasSelection === true
    // Utiliser la fonction modifiée si hasSelection === false
    if (service.hasSelection) {
      result = await scrapeMidasPriceBackup(plate, service);
    } else {
      result = await scrapeMidasPriceModified(plate, service);
    }
    
    if (result.success) {
      console.log(`   ✅ [${service.id}] Prix trouvé: ${result.price}€`);
      return {
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
        price: result.price,
        url: result.url,
        success: true,
        scrapedAt: new Date().toISOString(),
        hasSelection: service.hasSelection
      };
    } else {
      console.log(`   ❌ [${service.id}] Erreur: ${result.error}`);
      return {
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
        success: false,
        error: result.error,
        scrapedAt: new Date().toISOString(),
        hasSelection: service.hasSelection
      };
    }
  } catch (error) {
    console.log(`   ❌ [${service.id}] Exception: ${error.message}`);
    return {
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      success: false,
      error: error.message,
      scrapedAt: new Date().toISOString(),
      hasSelection: service.hasSelection
    };
  }
}

/**
 * Fonction pour traiter les services séquentiellement par batch de 2
 */
async function processBatchSequential(plate, services, batchSize = 2) {
  const results = [];
  
  for (let i = 0; i < services.length; i += batchSize) {
    const batch = services.slice(i, i + batchSize);
    console.log(`\n📦 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(services.length / batchSize)} (${batch.length} service(s))...`);
    
    // Traiter les services du batch SÉQUENTIELLEMENT (un après l'autre)
    for (let j = 0; j < batch.length; j++) {
      const service = batch[j];
      const result = await scrapeService(plate, service);
      results.push(result);
      
      // Petit délai entre les services du même batch
      if (j < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Délai entre les batches pour laisser le système respirer
    if (i + batchSize < services.length) {
      console.log('   ⏸️  Pause avant le prochain batch...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

/**
 * Fonction principale pour scraper tous les services séquentiellement (par batch de 2)
 */
async function scrapeAllServicesParallel(plate) {
  const startTime = Date.now();
  
  console.log('🔄 Lancement des scrapings SÉQUENTIELS (batch de 2 services)...\n');
  console.log(`📊 Total de services à scraper: ${servicesToScrape.length}\n`);
  
  // Traiter les services séquentiellement par batch de 2
  const allResults = await processBatchSequential(plate, servicesToScrape, 2);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Préparer les données à sauvegarder
  const outputData = {
    plate: plate,
    scrapedAt: new Date().toISOString(),
    durationSeconds: parseFloat(duration),
    totalServices: allResults.length,
    successful: allResults.filter(r => r.success).length,
    failed: allResults.filter(r => !r.success).length,
    results: allResults
  };
  
  // Sauvegarder dans un fichier JSON
  const outputFile = path.join(__dirname, `scraping_results_${plate}_${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');
  
  // Afficher le résumé
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ DU SCRAPING');
  console.log('═'.repeat(60));
  console.log(`Plaque: ${plate}`);
  console.log(`Durée totale: ${duration} secondes`);
  console.log(`Total services: ${allResults.length}`);
  console.log(`✅ Réussis: ${allResults.filter(r => r.success).length}`);
  console.log(`❌ Échoués: ${allResults.filter(r => !r.success).length}`);
  console.log(`\n📄 Résultats sauvegardés dans: ${outputFile}`);
  
  // Afficher les prix trouvés
  const successfulResults = allResults.filter(r => r.success);
  if (successfulResults.length > 0) {
    console.log('\n💰 PRIX TROUVÉS:');
    successfulResults.forEach(r => {
      console.log(`   ${r.serviceName}: ${r.price}€`);
    });
  }
  
  // Afficher les erreurs
  const failedResults = allResults.filter(r => !r.success);
  if (failedResults.length > 0) {
    console.log('\n❌ ERREURS:');
    failedResults.forEach(r => {
      console.log(`   ${r.serviceName}: ${r.error}`);
    });
  }
  
  return outputData;
}

/**
 * Exécution principale
 */
(async () => {
  try {
    const results = await scrapeAllServicesParallel(PLATE_NUMBER);
    console.log('\n✅ Scraping terminé !');
  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
})();

