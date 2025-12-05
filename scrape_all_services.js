/**
 * Script pour scraper tous les prix de toutes les prestations pour une plaque donnée
 * Usage: node scrape_all_services.js [plaque]
 * Exemple: node scrape_all_services.js EV404YY
 */

const { scrapeMidasPrice } = require('./scrape_midas_price');
const fs = require('fs');
const path = require('path');

// Charger la configuration des services
const servicesConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'services_config.json'), 'utf8')
);

// Récupérer la plaque depuis les arguments
const args = process.argv.slice(2);
const PLATE_NUMBER = args[0] || 'EV404YY';

// Filtrer les services à scraper (exclure ceux avec skipScraping)
const servicesToScrape = servicesConfig.services.filter(s => !s.skipScraping);

console.log('🚀 Scraping de tous les prix pour toutes les prestations');
console.log(`📋 Plaque: ${PLATE_NUMBER}`);
console.log(`📊 Nombre de services: ${servicesToScrape.length}`);
console.log('');

/**
 * Fonction pour scraper un prix Midas (utilise la fonction générique)
 */
async function scrapeMidasPriceWrapper(plate, service) {
  // Utiliser la fonction générique
  return await scrapeMidasPrice(plate, service);
}

/**
 * Fonction principale pour scraper tous les services
 */
async function scrapeAllServices(plate) {
  const results = [];
  const totalServices = servicesToScrape.length;

  console.log(`🔄 Début du scraping de ${totalServices} services...\n`);

  for (let i = 0; i < servicesToScrape.length; i++) {
    const service = servicesToScrape[i];
    console.log(`[${i + 1}/${totalServices}] 🔧 ${service.name}...`);

    try {
      const result = await scrapeMidasPriceWrapper(plate, service);
      
      if (result.success) {
        console.log(`   ✅ Prix trouvé: ${result.price}€`);
        results.push({
          serviceId: service.id,
          serviceName: service.name,
          category: service.category,
          price: result.price,
          url: result.url,
          success: true,
          scrapedAt: new Date().toISOString()
        });
      } else {
        console.log(`   ❌ Erreur: ${result.error}`);
        results.push({
          serviceId: service.id,
          serviceName: service.name,
          category: service.category,
          success: false,
          error: result.error,
          scrapedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`);
      results.push({
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
        success: false,
        error: error.message,
        scrapedAt: new Date().toISOString()
      });
    }

    // Pause entre chaque service pour ne pas surcharger
    if (i < totalServices - 1) {
      console.log('   ⏳ Pause de 2 secondes...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

/**
 * Exécution principale
 */
(async () => {
  try {
    const results = await scrapeAllServices(PLATE_NUMBER);

    // Sauvegarder les résultats dans un fichier JSON
    const outputFile = path.join(__dirname, `scraping_results_${PLATE_NUMBER}_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');

    // Afficher le résumé
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RÉSUMÉ DU SCRAPING');
    console.log('═'.repeat(60));
    console.log(`Plaque: ${PLATE_NUMBER}`);
    console.log(`Total services: ${results.length}`);
    console.log(`Réussis: ${results.filter(r => r.success).length}`);
    console.log(`Échoués: ${results.filter(r => !r.success).length}`);
    console.log(`\n📄 Résultats sauvegardés dans: ${outputFile}`);

    // Afficher les prix trouvés
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
      console.log('\n💰 PRIX TROUVÉS:');
      successfulResults.forEach(r => {
        console.log(`   ${r.serviceName}: ${r.price}€`);
      });
    }

    // Afficher les erreurs
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log('\n❌ ERREURS:');
      failedResults.forEach(r => {
        console.log(`   ${r.serviceName}: ${r.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
})();

