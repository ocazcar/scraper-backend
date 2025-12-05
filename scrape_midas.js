/**
 * Service de scraping Midas pour récupérer les prix des plaquettes de frein
 * Utilise Puppeteer pour simuler un navigateur réel
 */

const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase pour le cache
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Génère une clé de cache unique pour un véhicule et un service
 */
function getCacheKey(brand, model, year, service) {
  return `midas_price_${brand}_${model}_${year || 'any'}_${service}`.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Vérifie si le résultat est en cache
 */
async function getCachedPrice(cacheKey) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('scraper_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) return null;
    
    return {
      price: data.price,
      priceWithInstallation: data.price_with_installation,
      url: data.url,
      scrapedAt: new Date(data.scraped_at),
    };
  } catch (error) {
    console.error('Erreur lors de la récupération du cache:', error);
    return null;
  }
}

/**
 * Met en cache le résultat
 */
async function setCachedPrice(cacheKey, result, ttlHours = 1) {
  if (!supabase) return;
  
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);
    
    await supabase
      .from('scraper_cache')
      .upsert({
        cache_key: cacheKey,
        price: result.price,
        price_with_installation: result.priceWithInstallation,
        url: result.url,
        scraped_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'cache_key',
      });
  } catch (error) {
    console.error('Erreur lors de la mise en cache:', error);
  }
}

/**
 * Scrape le prix depuis Midas
 */
async function scrapeMidasPrice(brand, model, year, service = 'plaquettes-de-frein-avant') {
  const cacheKey = getCacheKey(brand, model, year, service);
  
  // Vérifier le cache d'abord
  const cached = await getCachedPrice(cacheKey);
  if (cached) {
    console.log('✅ Prix récupéré depuis le cache');
    return {
      success: true,
      ...cached,
    };
  }
  
  let browser = null;
  
  try {
    // Lancer le navigateur
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    
    const page = await browser.newPage();
    
    // Masquer les signes d'automatisation
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // Définir un user-agent réaliste
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Construire l'URL de recherche Midas
    // Format: https://www.midas.fr/recherche?q=plaquettes+frein+avant+Renault+Clio
    const searchQuery = `${service.replace(/-/g, ' ')} ${brand} ${model}`.replace(/\s+/g, '+');
    const searchUrl = `https://www.midas.fr/recherche?q=${encodeURIComponent(searchQuery)}`;
    
    console.log(`🔍 Recherche sur Midas: ${searchUrl}`);
    
    // Naviguer vers la page de recherche
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    // Attendre un peu pour que la page se charge
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    // Accepter les cookies si nécessaire
    try {
      const cookieButton = await page.$('button[id*="cookie"], button[class*="cookie"], button:has-text("Accepter")');
      if (cookieButton) {
        await cookieButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // Pas de bouton cookie ou déjà accepté
    }
    
    // Chercher le prix sur la page
    // Sélecteurs possibles pour Midas
    const priceSelectors = [
      '.price',
      '[class*="price"]',
      '[data-price]',
      '.product-price',
      '.price-value',
      'span:contains("€")',
    ];
    
    let price = null;
    let priceWithInstallation = null;
    let productUrl = searchUrl;
    
    // Essayer de trouver le prix
    for (const selector of priceSelectors) {
      try {
        const priceElement = await page.$(selector);
        if (priceElement) {
          const priceText = await page.evaluate((el) => el.textContent, priceElement);
          const priceMatch = priceText.match(/(\d+[.,]\d+)/);
          if (priceMatch) {
            price = parseFloat(priceMatch[1].replace(',', '.'));
            break;
          }
        }
      } catch (e) {
        // Continuer avec le prochain sélecteur
      }
    }
    
    // Si on a trouvé un produit, cliquer dessus pour voir le prix avec installation
    try {
      const firstProduct = await page.$('a[href*="/produit"], a[href*="/p/"], .product-item a');
      if (firstProduct) {
        const href = await page.evaluate((el) => el.href, firstProduct);
        if (href) {
          productUrl = href;
          
          // Naviguer vers la page produit
          await page.goto(href, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });
          await page.waitForTimeout(2000);
          
          // Chercher le prix avec installation
          const installationPriceSelectors = [
            '[class*="installation"] [class*="price"]',
            '[class*="montage"] [class*="price"]',
            '.total-price',
            '[data-total-price]',
          ];
          
          for (const selector of installationPriceSelectors) {
            try {
              const totalElement = await page.$(selector);
              if (totalElement) {
                const totalText = await page.evaluate((el) => el.textContent, totalElement);
                const totalMatch = totalText.match(/(\d+[.,]\d+)/);
                if (totalMatch) {
                  priceWithInstallation = parseFloat(totalMatch[1].replace(',', '.'));
                  break;
                }
              }
            } catch (e) {
              // Continuer
            }
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Impossible de récupérer le prix avec installation');
    }
    
    // Si on n'a pas trouvé de prix, retourner une erreur
    if (!price) {
      throw new Error('Prix non trouvé sur la page Midas');
    }
    
    const result = {
      success: true,
      price,
      priceWithInstallation: priceWithInstallation || price,
      url: productUrl,
      scrapedAt: new Date(),
    };
    
    // Mettre en cache
    await setCachedPrice(cacheKey, result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur lors du scraping Midas:', error);
    return {
      success: false,
      error: error.message,
      price: 0,
      priceWithInstallation: 0,
      url: '',
      scrapedAt: new Date(),
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Export pour utilisation en tant que module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrapeMidasPrice, getCacheKey, getCachedPrice, setCachedPrice };
}

// Si exécuté directement, tester
if (require.main === module) {
  (async () => {
    const result = await scrapeMidasPrice('Renault', 'Clio', 2020, 'plaquettes-de-frein-avant');
    console.log('Résultat:', JSON.stringify(result, null, 2));
  })();
}

