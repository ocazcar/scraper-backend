# Service de Scraping Backend pour Prix Concurrents

Ce service backend permet de récupérer automatiquement les prix depuis Midas et Norauto pour un véhicule donné.

## Architecture

```
Client (Site OCAZCAR)
    ↓
API Backend (/api/scrape/midas ou /api/scrape/norauto)
    ↓
Service de Scraping (Node.js/Python)
    ↓
Midas/Norauto (avec gestion anti-bot)
    ↓
Cache (Redis/Supabase) pour éviter les requêtes répétées
```

## Installation

### Option 1 : Node.js avec Puppeteer (Recommandé pour Midas)

```bash
cd SCRAPER_BACKEND
npm install puppeteer axios cheerio
```

### Option 2 : Python avec Playwright (Alternative)

```bash
cd SCRAPER_BACKEND
pip install playwright beautifulsoup4 requests
playwright install chromium
```

## Configuration

1. Créer un fichier `.env` :
```env
PORT=3001
CACHE_TTL=3600  # Cache pendant 1 heure
MIDAS_BASE_URL=https://www.midas.fr
NORAUTO_BASE_URL=https://www.norauto.fr
```

## Utilisation

### Endpoint Midas

```bash
POST /api/scrape/midas
Content-Type: application/json

{
  "brand": "Renault",
  "model": "Clio",
  "year": 2020,
  "plate": "AB-123-CD",
  "service": "plaquettes-de-frein-avant"
}
```

### Endpoint Norauto

```bash
POST /api/scrape/norauto
Content-Type: application/json

{
  "brand": "Renault",
  "model": "Clio",
  "year": 2020,
  "plate": "AB-123-CD",
  "service": "plaquettes-de-frein-avant"
}
```

## Réponse

```json
{
  "success": true,
  "price": 79.90,
  "priceWithInstallation": 136.85,
  "url": "https://www.midas.fr/...",
  "scrapedAt": "2025-01-20T10:30:00Z"
}
```

## Stratégies Anti-Bot

1. **Délais aléatoires** : Attendre 2-5 secondes entre les requêtes
2. **Rotation User-Agent** : Changer l'user-agent à chaque requête
3. **Proxy rotation** : Utiliser des proxies différents
4. **Headless Browser** : Utiliser Puppeteer/Playwright en mode headless
5. **Cache agressif** : Mettre en cache les résultats pour éviter les requêtes répétées

## Cache

Les résultats sont mis en cache dans Supabase ou Redis avec une clé basée sur :
- Marque + Modèle + Année + Service

TTL par défaut : 1 heure

## Limitations

- **Rate Limiting** : Ne pas faire plus de 10 requêtes/minute
- **Respect des robots.txt** : Vérifier avant de scraper
- **Légalité** : S'assurer que le scraping est légal dans votre juridiction

