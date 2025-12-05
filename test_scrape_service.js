/**
 * Script de test pour scraper un service spécifique
 * Usage: node test_scrape_service.js [plaque] [serviceId]
 * Exemple: node test_scrape_service.js EV404YY plaquettes-avant
 * Exemple: node test_scrape_service.js EV404YY embrayage
 */

const { scrapeMidasPrice } = require('./scrape_midas_price');
const fs = require('fs');
const path = require('path');

// Charger la configuration
const servicesConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'services_config.json'), 'utf8')
);

// Récupérer les arguments
const args = process.argv.slice(2);
const PLATE_NUMBER = args[0] || 'EV404YY';
const SERVICE_ID = args[1] || 'plaquettes-avant';

// Trouver le service dans la config
const service = servicesConfig.services.find(s => s.id === SERVICE_ID);

if (!service) {
  console.error(`❌ Service "${SERVICE_ID}" non trouvé dans la configuration`);
  console.log('\nServices disponibles:');
  servicesConfig.services.forEach(s => {
    console.log(`  - ${s.id}: ${s.name}`);
  });
  process.exit(1);
}

if (service.skipScraping) {
  console.log(`ℹ️  Le service "${service.name}" ne nécessite pas de scraping`);
  process.exit(0);
}

console.log('🚀 Test de scraping Midas');
console.log(`📋 Plaque: ${PLATE_NUMBER}`);
console.log(`🔧 Service: ${service.name}`);
console.log(`📄 URL: ${service.midasUrl}`);
console.log(`🎯 Sélection requise: ${service.hasSelection ? 'Oui' : 'Non'}`);
if (service.hasSelection) {
  console.log(`   Options: ${service.selectionOptions.join(', ')}`);
}
console.log('');

// Appeler la fonction de scraping
(async () => {
  const result = await scrapeMidasPrice(PLATE_NUMBER, service);

  console.log('');
  console.log('═'.repeat(60));
  if (result.success) {
    console.log('✅ SCRAPING RÉUSSI');
    console.log(`   Prix: ${result.price}€`);
    console.log(`   URL: ${result.url}`);
  } else {
    console.log('❌ SCRAPING ÉCHOUÉ');
    console.log(`   Erreur: ${result.error}`);
  }
  console.log('═'.repeat(60));
})();

