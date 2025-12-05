# Architecture du Système de Scraping

## 🏗️ Architecture Client-Serveur

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Téléphone/PC)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Site OCAZCAR (Frontend React)                       │  │
│  │                                                       │  │
│  │  - Client entre sa plaque                            │  │
│  │  - Appelle l'API : /api/scrape/midas                 │  │
│  │  - Reçoit juste le prix (JSON)                       │  │
│  │  - Affiche le prix                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Request (JSON)
                          │ { plate: "EV404YY", service: "plaquettes-avant" }
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVEUR (Votre Serveur)                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Backend (Node.js/Express)                       │  │
│  │  - Reçoit la requête du client                       │  │
│  │  - Vérifie le cache (Supabase)                       │  │
│  │  - Si pas en cache → Lance le scraping               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Service de Scraping (Playwright/Puppeteer)          │  │
│  │  - Ouvre un navigateur (Safari/Chrome)               │  │
│  │  - Navigue sur Midas                                 │  │
│  │  - Remplit le formulaire                             │  │
│  │  - Extrait le prix                                   │  │
│  │  - Ferme le navigateur                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Cache (Supabase)                                    │  │
│  │  - Stocke le prix pour éviter de re-scraper          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Response (JSON)
                          │ { price: 79.90, success: true }
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Téléphone/PC)                    │
│  - Reçoit le prix                                           │
│  - Affiche à l'utilisateur                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🔒 Sécurité et Confidentialité

### ✅ Ce qui se passe côté SERVEUR (votre machine)
- Le scraping avec Playwright/Puppeteer
- L'ouverture du navigateur
- La navigation sur Midas
- L'extraction des données
- Le stockage en cache

### ✅ Ce qui se passe côté CLIENT (téléphone du client)
- **RIEN** de tout ça !
- Juste un appel API simple : `fetch('/api/scrape/midas', { plate: "EV404YY" })`
- Réception du résultat : `{ price: 79.90 }`
- Affichage du prix à l'utilisateur

## 📡 Flux de Données

### 1. Client demande un prix
```javascript
// Dans votre site (frontend)
const response = await fetch('https://votre-serveur.com/api/scrape/midas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    plate: 'EV404YY',
    service: 'plaquettes-avant'
  })
});

const data = await response.json();
// data = { price: 79.90, success: true }
```

### 2. Serveur fait le scraping
```javascript
// Sur votre serveur (backend)
app.post('/api/scrape/midas', async (req, res) => {
  const { plate, service } = req.body;
  
  // Vérifier le cache
  const cached = await getCachedPrice(plate, service);
  if (cached) {
    return res.json(cached); // Retourne immédiatement
  }
  
  // Scraper (côté serveur uniquement)
  const result = await scrapeMidas(plate, service);
  
  // Mettre en cache
  await cachePrice(plate, service, result);
  
  // Retourner au client
  res.json(result);
});
```

### 3. Client reçoit le prix
```javascript
// Le client reçoit juste le JSON
{ price: 79.90, priceWithInstallation: 136.85, success: true }
```

## 🚀 Déploiement

### Option 1 : Serveur Dédié
- Votre propre serveur (VPS, AWS, etc.)
- Le scraping tourne sur ce serveur
- Votre site appelle ce serveur

### Option 2 : Serverless (Vercel, Netlify Functions)
- Fonction serverless qui fait le scraping
- Appelée depuis votre site
- Limite de temps d'exécution (peut être un problème pour le scraping)

### Option 3 : Service Backend Séparé
- Un service backend dédié (Node.js)
- Tourne en permanence
- Votre site frontend l'appelle via API

## ⚠️ Points Importants

1. **Le client ne voit JAMAIS le processus de scraping**
   - Pas de navigateur qui s'ouvre sur son téléphone
   - Pas de Playwright/Puppeteer sur son appareil
   - Juste un appel API et une réponse JSON

2. **Tout le scraping se fait sur VOTRE serveur**
   - Votre serveur a Playwright/Puppeteer installé
   - Votre serveur ouvre le navigateur
   - Votre serveur fait le scraping

3. **Le cache évite de re-scraper**
   - Si le prix est déjà en cache, retour immédiat
   - Pas besoin de re-scraper à chaque fois
   - Économise des ressources

## 🔧 Configuration

### Variables d'Environnement
```env
# Sur votre serveur
SCRAPER_API_URL=https://votre-serveur.com/api/scrape
CACHE_TTL=3600  # Cache pendant 1 heure
```

### Frontend (votre site)
```typescript
// Le client appelle juste votre API
const price = await getMidasPrice(vehicle, service);
// Cette fonction fait juste un fetch vers votre serveur
```

## 📊 Résumé

| Composant | Où ça tourne | Rôle |
|-----------|--------------|------|
| **Frontend React** | Téléphone/PC du client | Affiche l'interface, appelle l'API |
| **API Backend** | Votre serveur | Reçoit les requêtes, gère le cache |
| **Scraper (Playwright)** | Votre serveur | Fait le scraping sur Midas |
| **Cache (Supabase)** | Cloud (Supabase) | Stocke les prix scrapés |

**Le client ne fait JAMAIS de scraping directement !** 🎯

