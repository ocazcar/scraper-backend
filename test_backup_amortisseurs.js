/**
 * Script de test pour tester la fonction backup avec le lien des amortisseurs
 * Usage: node test_backup_amortisseurs.js [plaque]
 * Exemple: node test_backup_amortisseurs.js EV404YY
 */

const { scrapeMidasPrice } = require('./scrape_midas_price_backup');
const args = process.argv.slice(2);
const PLATE_NUMBER = args[0] || 'EV404YY';

// Configuration du service pour les amortisseurs (similaire à celle dans services_config.json)
const serviceConfig = {
  id: 'amortisseurs-avant',
  name: 'Amortisseurs avant',
  midasService: 'amortisseurs-avant',
  midasUrl: 'https://www.midas.fr/devis/prestations/amortisseurs-avant-et-arriere',
  category: 'suspension',
  description: 'Remplacement des amortisseurs avant',
  hasSelection: true,
  selectionOptions: ['Amortisseurs avant', 'Amortisseurs arrière', 'Les deux'],
  selectionType: 'amortisseurs'
};

console.log('🧪 Test de la fonction backup avec le lien des amortisseurs');
console.log(`📋 Plaque: ${PLATE_NUMBER}`);
console.log(`🔧 Service: ${serviceConfig.name}`);
console.log(`📄 URL: ${serviceConfig.midasUrl}`);
console.log(`🎯 Sélection requise: ${serviceConfig.hasSelection ? 'Oui' : 'Non'}`);
if (serviceConfig.hasSelection) {
  console.log(`   Options: ${serviceConfig.selectionOptions.join(', ')}`);
}
console.log('');

// Appeler la fonction de scraping
(async () => {
  const result = await scrapeMidasPrice(PLATE_NUMBER, serviceConfig);

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

