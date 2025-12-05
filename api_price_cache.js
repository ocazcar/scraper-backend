/**
 * API pour gérer le cache des prix Midas
 * Vérifie d'abord le cache, puis lance le scraping si nécessaire
 */

const { supabase } = require('./supabaseClient');
const { scrapeMidasComplete } = require('./scrape_midas_complete');
const servicesConfig = require('./services_config.json');

if (!supabase) {
  console.warn('⚠️  Supabase non configuré – le cache des prix sera désactivé.');
}

// Durée de validité du cache (en heures)
const CACHE_VALIDITY_HOURS = 24;

/**
 * Normalise une clé de véhicule à partir des informations du véhicule
 * Format: MARQUE_MODELE_MOTORISATION_ANNEE
 */
function normalizeVehicleKey(vehicleInfo) {
  const { brand, model, engine, year } = vehicleInfo;
  
  // Normaliser les valeurs : convertir en majuscules, trim, remplacer les caractères non alphanumériques par des underscores
  // Puis remplacer les underscores multiples par un seul underscore
  const normalizeString = (str) => {
    if (!str) return '';
    return str.toUpperCase().trim()
      .replace(/[^A-Z0-9]/g, '_')  // Remplacer tout caractère non alphanumérique par _
      .replace(/_+/g, '_')          // Remplacer les underscores multiples par un seul
      .replace(/^_|_$/g, '');       // Supprimer les underscores en début/fin
  };
  
  const normalizedBrand = normalizeString(brand);
  const normalizedModel = normalizeString(model);
  const normalizedEngine = normalizeString(engine);
  const normalizedYear = year ? String(year).trim() : '';
  
  // Construire la clé
  const parts = [normalizedBrand, normalizedModel];
  if (normalizedEngine) {
    parts.push(normalizedEngine);
  }
  if (normalizedYear) {
    parts.push(normalizedYear);
  }
  
  // Filtrer les parties vides et joindre
  const vehicleKey = parts.filter(p => p).join('_');
  
  return vehicleKey;
}

/**
 * Trouve la configuration du service à partir de l'ID de prestation
 */
function findServiceConfig(prestationId) {
  const services = Array.isArray(servicesConfig.services) 
    ? servicesConfig.services 
    : Object.values(servicesConfig);
  
  return services.find(s => s.id === prestationId || s.midasService === prestationId);
}

/**
 * Convertit la sélection de l'utilisateur en format attendu par le scraper
 */
function normalizeSelection(prestationId, userSelection) {
  const serviceConfig = findServiceConfig(prestationId);
  
  console.log(`🔧 normalizeSelection - prestationId: ${prestationId}, userSelection: ${userSelection}`);
  console.log(`🔧 Service config - hasSelection: ${serviceConfig?.hasSelection}, selectionType: ${serviceConfig?.selectionType}`);
  
  if (!serviceConfig || !serviceConfig.hasSelection) {
    console.log(`   ⏭️  Pas de sélection nécessaire pour ${prestationId}`);
    return null; // Pas de sélection nécessaire
  }
  
  // Si l'utilisateur a déjà fourni une sélection, la retourner
  if (userSelection) {
    console.log(`   ✅ Sélection fournie: "${userSelection}"`);
    return userSelection;
  }
  
  // Sinon, retourner null (le scraper gérera)
  console.log(`   ⚠️  Aucune sélection fournie pour ${prestationId} (hasSelection=true)`);
  return null;
}

/**
 * Vérifie si un prix existe dans le cache et est encore valide
 */
async function getCachedPrice(prestationId, vehicleKey, selection) {
  console.log(`\n🔍 [getCachedPrice] DÉBUT de la vérification du cache`);
  console.log(`   Paramètres reçus:`);
  console.log(`   - prestationId: "${prestationId}"`);
  console.log(`   - vehicleKey: "${vehicleKey}"`);
  console.log(`   - selection: ${selection === null ? 'null' : `"${selection}"`}`);
  
  if (!supabase) {
    console.log('⚠️  [getCachedPrice] Supabase non configuré, impossible de vérifier le cache');
    return null;
  }
  
  try {
    // Vérifier si la prestation nécessite une sélection (dans services_config.json)
    const serviceConfig = findServiceConfig(prestationId);
    const hasSelection = serviceConfig?.hasSelection === true;
    
    console.log(`   Configuration du service:`);
    console.log(`   - hasSelection: ${hasSelection}`);
    console.log(`   - serviceConfig trouvé: ${serviceConfig ? 'OUI' : 'NON'}`);
    
    // Construire la requête selon la logique :
    // - Prestation SANS sélection (ex: embrayage) : chercher avec selection = null
    // - Prestation AVEC sélection (ex: plaquettes) : chercher avec la sélection exacte
    
    let query = supabase
      .from('prices')
      .select('*')
      .eq('prestation', prestationId)
      .eq('vehicle_key', vehicleKey);
    
    if (hasSelection) {
      // Prestation AVEC sélection : chercher la sélection exacte
      if (selection) {
        query = query.eq('selection', selection);
        console.log(`   → Requête: prestation="${prestationId}" AND vehicle_key="${vehicleKey}" AND selection="${selection}"`);
      } else {
        query = query.is('selection', null);
        console.log(`   → Requête: prestation="${prestationId}" AND vehicle_key="${vehicleKey}" AND selection IS NULL`);
      }
    } else {
      // Prestation SANS sélection : chercher avec selection = null
      query = query.is('selection', null);
      console.log(`   → Requête: prestation="${prestationId}" AND vehicle_key="${vehicleKey}" AND selection IS NULL (prestation sans sélection)`);
    }
    
    console.log(`   🔎 Exécution de la requête Supabase...`);
    
    // Utiliser .select() au lieu de .maybeSingle() pour gérer plusieurs résultats
    // Puis filtrer pour prendre la plus récente
    const { data, error } = await query
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      // Si l'erreur est "multiple rows", essayer de récupérer toutes les lignes et filtrer
      if (error.code === 'PGRST116' && error.details?.includes('Results contain')) {
        console.log(`   ⚠️  Plusieurs résultats trouvés, récupération de toutes les lignes pour filtrer...`);
        const { data: allData, error: allError } = await supabase
          .from('prices')
          .select('*')
          .eq('prestation', prestationId)
          .eq('vehicle_key', vehicleKey)
          .order('last_updated', { ascending: false });
        
        if (allError) {
          console.error('❌ [getCachedPrice] Erreur lors de la récupération de toutes les lignes:', allError);
          return null;
        }
        
        if (!allData || allData.length === 0) {
          console.log(`❌ [getCachedPrice] Aucune ligne trouvée après récupération multiple`);
          return null;
        }
        
        // Filtrer selon la logique
        let matchingEntry = null;
        if (hasSelection) {
          // Prestation AVEC sélection : chercher la sélection exacte
          if (selection) {
            matchingEntry = allData.find(entry => entry.selection === selection);
          } else {
            matchingEntry = allData.find(entry => entry.selection === null);
          }
        } else {
          // Prestation SANS sélection : prendre la première avec selection = null
          matchingEntry = allData.find(entry => entry.selection === null);
        }
        
        if (!matchingEntry) {
          console.log(`❌ [getCachedPrice] Aucune ligne ne correspond aux critères après filtrage`);
          console.log(`   📋 ${allData.length} ligne(s) trouvée(s), mais aucune ne correspond`);
          allData.forEach((entry, index) => {
            console.log(`      ${index + 1}. selection=${entry.selection === null ? 'NULL' : `"${entry.selection}"`}, price=${entry.price}€`);
          });
          return null;
        }
        
        // Utiliser la ligne trouvée
        const lastUpdated = new Date(matchingEntry.last_updated);
        const now = new Date();
        const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);
        
        console.log(`✅ [getCachedPrice] PRIX TROUVÉ DANS LE CACHE (après filtrage de ${allData.length} lignes) !`);
        console.log(`   - Prix: ${matchingEntry.price}€`);
        console.log(`   - Enregistré il y a: ${hoursDiff.toFixed(1)}h`);
        console.log(`   - selection dans la base: ${matchingEntry.selection === null ? 'NULL' : `"${matchingEntry.selection}"`}`);
        console.log(`🔍 [getCachedPrice] FIN - Cache trouvé, retour du prix\n`);
        
        return {
          price: parseFloat(matchingEntry.price),
          cached: true,
          lastUpdated: matchingEntry.last_updated
        };
      }
      
      console.error('❌ [getCachedPrice] Erreur lors de la récupération du cache:', error);
      console.error('   Détails:', JSON.stringify(error, null, 2));
        return null;
      }
    
    if (!data) {
      console.log(`❌ [getCachedPrice] Aucun prix trouvé avec les critères exacts`);
      
      // Debug : voir ce qui existe dans la base
      console.log(`   🔍 [DEBUG] Recherche de toutes les entrées pour cette prestation + vehicle_key...`);
      const { data: debugData, error: debugError } = await supabase
        .from('prices')
        .select('prestation, vehicle_key, selection, price, last_updated')
        .eq('prestation', prestationId)
        .eq('vehicle_key', vehicleKey)
        .limit(10);
      
      if (debugError) {
        console.error(`   ❌ [DEBUG] Erreur:`, debugError);
      } else if (debugData && debugData.length > 0) {
        console.log(`   📋 [DEBUG] ${debugData.length} entrée(s) trouvée(s) dans Supabase:`);
        debugData.forEach((entry, index) => {
          console.log(`      ${index + 1}. prestation="${entry.prestation}", vehicle_key="${entry.vehicle_key}", selection=${entry.selection === null ? 'NULL' : `"${entry.selection}"`}, price=${entry.price}€`);
        });
        console.log(`   ⚠️  [DEBUG] Aucune ne correspond aux critères (recherche: selection=${hasSelection ? (selection || 'NULL') : 'NULL'})`);
      } else {
        console.log(`   📋 [DEBUG] Aucune entrée trouvée dans Supabase pour prestation="${prestationId}" + vehicle_key="${vehicleKey}"`);
      }
      console.log(`🔍 [getCachedPrice] FIN - Aucun cache trouvé\n`);
      return null;
    }
    
    // Prix trouvé !
    const lastUpdated = new Date(data.last_updated);
    const now = new Date();
    const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);
    
    console.log(`✅ [getCachedPrice] PRIX TROUVÉ DANS LE CACHE !`);
    console.log(`   - Prix: ${data.price}€`);
    console.log(`   - Enregistré il y a: ${hoursDiff.toFixed(1)}h`);
    console.log(`   - selection dans la base: ${data.selection === null ? 'NULL' : `"${data.selection}"`}`);
    console.log(`🔍 [getCachedPrice] FIN - Cache trouvé, retour du prix\n`);
    
    return {
      price: parseFloat(data.price),
      cached: true,
      lastUpdated: data.last_updated
    };
  } catch (error) {
    console.error('❌ [getCachedPrice] Exception lors de la vérification du cache:', error);
    console.error('   Stack:', error.stack);
    return null;
  }
}

/**
 * Sauvegarde un prix dans le cache
 */
async function savePriceToCache(prestationId, vehicleKey, selection, price) {
  if (!supabase) {
    console.warn('⚠️  Supabase non configuré, impossible de sauvegarder dans le cache');
    return;
  }
  
  try {
    // Vérifier si la prestation nécessite une sélection
    const serviceConfig = findServiceConfig(prestationId);
    const hasSelection = serviceConfig?.hasSelection === true;
    
    // Pour les prestations sans sélection, forcer selection = null
    const finalSelection = hasSelection ? (selection || null) : null;
    
    console.log(`💾 Sauvegarde dans le cache:`);
    console.log(`   - prestation: ${prestationId} (hasSelection: ${hasSelection})`);
    console.log(`   - vehicle_key: ${vehicleKey}`);
    console.log(`   - selection: ${finalSelection || 'null'}`);
    console.log(`   - price: ${price}€`);
    
    const { error } = await supabase
      .from('prices')
      .upsert({
        prestation: prestationId,
        vehicle_key: vehicleKey,
        selection: finalSelection,
        price: price,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'prestation,vehicle_key,selection'
      });
    
    if (error) {
      console.error('❌ Erreur lors de la sauvegarde dans le cache:', error);
    } else {
      console.log(`✅ Prix ${price}€ sauvegardé dans le cache`);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde dans le cache:', error);
  }
}

/**
 * Identifie les deux prestations (avant + arrière) à partir d'un serviceSlug
 */
function getBothPrestations(serviceSlug) {
  const mapping = {
    'plaquettes-de-frein': {
      avant: 'plaquettes-avant',
      arriere: 'plaquettes-arriere',
      selectionAvant: 'Plaquette avant',
      selectionArriere: 'Plaquette arrière'
    },
    'disques-de-frein': {
      avant: 'disques-avant',
      arriere: 'disques-arriere',
      selectionAvant: 'Disque avant',
      selectionArriere: 'Disque arrière'
    },
    'amortisseurs': {
      avant: 'amortisseurs-avant',
      arriere: 'amortisseurs-arriere',
      selectionAvant: 'Amortisseurs avant',
      selectionArriere: 'Amortisseurs arrière'
    }
  };
  
  return mapping[serviceSlug] || null;
}

/**
 * Récupère le prix pour "Les deux" (avant + arrière) en parallèle
 */
async function getPriceForBoth(serviceSlug, plate, vehicleInfo) {
  console.log(`\n📋 === REQUÊTE "LES DEUX" ===`);
  console.log(`   Service: ${serviceSlug}`);
  console.log(`   Plaque: ${plate}`);
  console.log(`   Véhicule: ${vehicleInfo.brand} ${vehicleInfo.model} ${vehicleInfo.year || ''}`.trim());
  
  // Identifier les deux prestations
  const prestations = getBothPrestations(serviceSlug);
  if (!prestations) {
    return {
      success: false,
      error: `Service "${serviceSlug}" ne supporte pas "Les deux"`
    };
  }
  
  const vehicleKey = normalizeVehicleKey(vehicleInfo);
  console.log(`   Vehicle Key: ${vehicleKey}`);
  console.log(`   Prestation avant: ${prestations.avant}`);
  console.log(`   Prestation arrière: ${prestations.arriere}`);
  
  // Vérifier le cache pour les deux prestations
  console.log(`\n🔍 Vérification du cache pour les deux prestations...`);
  const [cachedAvant, cachedArriere] = await Promise.all([
    getCachedPrice(prestations.avant, vehicleKey, prestations.selectionAvant),
    getCachedPrice(prestations.arriere, vehicleKey, prestations.selectionArriere)
  ]);
  
  let priceAvant = null;
  let priceArriere = null;
  let allCached = true;
  
  // Récupérer ou scraper le prix avant
  if (cachedAvant) {
    priceAvant = cachedAvant.price;
    console.log(`✅ Prix avant trouvé dans le cache: ${priceAvant}€`);
  } else {
    allCached = false;
    console.log(`🔄 Prix avant non trouvé dans le cache, scraping nécessaire...`);
  }
  
  // Récupérer ou scraper le prix arrière
  if (cachedArriere) {
    priceArriere = cachedArriere.price;
    console.log(`✅ Prix arrière trouvé dans le cache: ${priceArriere}€`);
  } else {
    allCached = false;
    console.log(`🔄 Prix arrière non trouvé dans le cache, scraping nécessaire...`);
  }
  
  // Lancer les scrapings en parallèle pour ceux qui ne sont pas en cache
  const scrapingPromises = [];
  
  if (!priceAvant) {
    const configAvant = findServiceConfig(prestations.avant);
    if (configAvant && !configAvant.skipScraping && configAvant.midasUrl) {
      scrapingPromises.push(
        scrapeMidasComplete(plate, configAvant.midasUrl, prestations.selectionAvant)
          .then(result => ({ type: 'avant', result }))
          .catch(error => ({ type: 'avant', error: error.message }))
      );
    } else {
      return {
        success: false,
        error: `Configuration manquante pour ${prestations.avant}`
      };
    }
  }
  
  if (!priceArriere) {
    const configArriere = findServiceConfig(prestations.arriere);
    if (configArriere && !configArriere.skipScraping && configArriere.midasUrl) {
      scrapingPromises.push(
        scrapeMidasComplete(plate, configArriere.midasUrl, prestations.selectionArriere)
          .then(result => ({ type: 'arriere', result }))
          .catch(error => ({ type: 'arriere', error: error.message }))
      );
    } else {
      return {
        success: false,
        error: `Configuration manquante pour ${prestations.arriere}`
      };
    }
  }
  
  // Attendre que tous les scrapings se terminent
  if (scrapingPromises.length > 0) {
    console.log(`\n🔄 Lancement de ${scrapingPromises.length} scraping(s) en parallèle...`);
    const scrapingResults = await Promise.all(scrapingPromises);
    
    for (const { type, result, error } of scrapingResults) {
      if (error) {
        return {
          success: false,
          error: `Erreur lors du scraping ${type}: ${error}`
        };
      }
      
      if (result.success && result.price) {
        if (type === 'avant') {
          priceAvant = result.price;
          await savePriceToCache(prestations.avant, vehicleKey, prestations.selectionAvant, result.price);
          console.log(`✅ Prix avant scrapé: ${priceAvant}€`);
        } else {
          priceArriere = result.price;
          await savePriceToCache(prestations.arriere, vehicleKey, prestations.selectionArriere, result.price);
          console.log(`✅ Prix arrière scrapé: ${priceArriere}€`);
        }
      } else {
        return {
          success: false,
          error: `Erreur lors du scraping ${type}: ${result?.error || 'Erreur inconnue'}`
        };
      }
    }
  }
  
  // Vérifier qu'on a les deux prix
  if (priceAvant === null || priceArriere === null) {
    return {
      success: false,
      error: 'Impossible de récupérer les deux prix'
    };
  }
  
  // Additionner les deux prix
  const totalPrice = priceAvant + priceArriere;
  console.log(`\n💰 CALCUL DU PRIX TOTAL:`);
  console.log(`   Prix avant: ${priceAvant}€`);
  console.log(`   Prix arrière: ${priceArriere}€`);
  console.log(`   Total: ${totalPrice}€`);
  console.log(`   Cache utilisé: ${allCached ? 'OUI (100%)' : 'PARTIEL'}\n`);
  
  return {
    success: true,
    price: totalPrice,
    cached: allCached,
    vehicleKey: vehicleKey
  };
}

/**
 * Récupère un prix (cache ou scraping)
 */
async function getPrice(prestationId, plate, vehicleInfo, userSelection = null) {
  // Normaliser la clé du véhicule
  const vehicleKey = normalizeVehicleKey(vehicleInfo);
  const normalizedSelection = normalizeSelection(prestationId, userSelection);
  
  console.log(`\n📋 === NOUVELLE REQUÊTE DE PRIX ===`);
  console.log(`   Prestation: ${prestationId}`);
  console.log(`   Plaque: ${plate}`);
  console.log(`   Véhicule: ${vehicleInfo.brand} ${vehicleInfo.model} ${vehicleInfo.year || ''}`.trim());
  console.log(`   Vehicle Key: ${vehicleKey}`);
  console.log(`   Sélection: ${normalizedSelection || 'aucune'}`);
  console.log(`\n🔍 ÉTAPE 1: Vérification du cache Supabase...`);
  
  // 1. Vérifier le cache AVANT tout scraping
  const cachedPrice = await getCachedPrice(prestationId, vehicleKey, normalizedSelection);
  if (cachedPrice) {
    console.log(`\n✅ RÉSULTAT: Prix récupéré depuis le cache (pas de scraping)`);
    console.log(`   Prix: ${cachedPrice.price}€\n`);
    return {
      success: true,
      price: cachedPrice.price,
      cached: true,
      vehicleKey: vehicleKey
    };
  }
  
  // 2. Si pas dans le cache, lancer le scraping
  console.log(`\n🔄 ÉTAPE 2: Aucun prix trouvé dans le cache, lancement du scraping...`);
  
  const serviceConfig = findServiceConfig(prestationId);
  if (!serviceConfig) {
    return {
      success: false,
      error: `Service ${prestationId} non trouvé dans la configuration`
    };
  }
  
  if (serviceConfig.skipScraping) {
    return {
      success: false,
      error: `Le service ${prestationId} ne doit pas être scrapé`
    };
  }
  
  // ⚠️ DÉSACTIVATION TEMPORAIRE : Courroie de distribution
  // Pour l'instant, on ne scrape pas la courroie de distribution
  if (prestationId === 'courroie-distribution') {
    console.log(`⏭️  Scraping désactivé pour ${prestationId} - retour du message d'erreur`);
    return {
      success: false,
      error: 'Nous ne pouvons pas vous proposer de devis en ligne pour l\'instant. Merci de bien vouloir nous contacter au 09 74 50 56 56 pour plus d\'informations.',
      price: null,
      vehicleKey: vehicleKey
    };
  }
  
  const midasUrl = serviceConfig.midasUrl;
  if (!midasUrl) {
    return {
      success: false,
      error: `URL Midas non configurée pour ${prestationId}`
    };
  }
  
  try {
    // Lancer le scraping
    console.log(`🔄 Lancement du scraping avec sélection: "${normalizedSelection}"`);
    const result = await scrapeMidasComplete(plate, midasUrl, normalizedSelection);
    
    if (result.success && result.price) {
      // Sauvegarder dans le cache
      console.log(`\n💾 ÉTAPE 3: Sauvegarde du prix dans le cache Supabase...`);
      await savePriceToCache(prestationId, vehicleKey, normalizedSelection, result.price);
      console.log(`   ✅ Prix ${result.price}€ sauvegardé pour ${vehicleKey}`);
      console.log(`   → Les prochaines requêtes pour ce véhicule utiliseront le cache\n`);
      
      return {
        success: true,
        price: result.price,
        cached: false,
        vehicleKey: vehicleKey
      };
    } else {
      // Si le scraping a échoué, retourner l'erreur
      return {
        success: false,
        error: result.error || 'Erreur lors du scraping'
      };
    }
  } catch (error) {
    console.error('Erreur lors du scraping:', error);
    return {
      success: false,
      error: error.message || 'Erreur inconnue lors du scraping'
    };
  }
}

module.exports = {
  getPrice,
  getPriceForBoth,
  normalizeVehicleKey,
  getCachedPrice,
  savePriceToCache
};

