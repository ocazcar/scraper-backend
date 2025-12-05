/**
 * Script de test AVEC SÉLECTION (utilise la fonction backup)
 * Usage: node test_avec_selection.js [plaque] [serviceId]
 * Exemple: node test_avec_selection.js EV404YY plaquettes-avant
 * Exemple: node test_avec_selection.js EV404YY amortisseurs-avant
 */

const { scrapeMidasPrice } = require('./scrape_midas_price_backup');
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

if (!service.hasSelection) {
  console.log(`⚠️  Le service "${service.name}" n'a pas de sélection. Utilisez test_sans_selection.js`);
  process.exit(0);
}

console.log('🧪 Test AVEC SÉLECTION (fonction backup)');
console.log(`📋 Plaque: ${PLATE_NUMBER}`);
console.log(`🔧 Service: ${service.name}`);
console.log(`📄 URL: ${service.midasUrl}`);
console.log(`🎯 Sélection requise: Oui`);
console.log(`   Options: ${service.selectionOptions.join(', ')}`);
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

