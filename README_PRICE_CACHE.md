# Système de Cache de Prix Midas

Ce système permet de mettre en cache les prix scrapés depuis Midas pour éviter de refaire des requêtes inutiles.

## Architecture

1. **Table Supabase `prices`** : Stocke les prix avec une clé unique (prestation + vehicle_key + selection)
2. **API Backend** : Vérifie le cache, lance le scraping si nécessaire, sauvegarde le résultat
3. **Frontend** : Appelle l'API et affiche le prix avec un loader pendant le scraping

## Installation

### 1. Créer la table dans Supabase

Exécutez le script SQL dans Supabase :
```sql
-- Voir SITE OCAZCAR/supabase/create_prices_table.sql
```

### 2. Configurer les variables d'environnement

**Backend** (`SCRAPER_BACKEND/.env`) :
```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key
PORT=3001
```

**Frontend** (`SITE OCAZCAR/.env`) :
```env
VITE_SCRAPER_API_URL=http://localhost:3001
```

### 3. Démarrer le serveur backend

```bash
cd SCRAPER_BACKEND
npm install
npm start
```

## Fonctionnement

### Flux de requête

1. **Utilisateur entre sa plaque** → Frontend appelle `/api/price`
2. **Backend vérifie le cache** :
   - Si prix existe et < 24h → Retourne immédiatement
   - Sinon → Lance le scraping
3. **Scraping** :
   - Saisit la plaque sur Midas
   - Sélectionne l'option si nécessaire
   - Extrait le prix
   - Sauvegarde dans le cache
4. **Frontend affiche** :
   - Loader pendant le scraping
   - Prix une fois récupéré
   - Message d'erreur si échec

### Mapping des services

Le système mappe automatiquement les `serviceSlug` du frontend vers les `prestationId` du scraper :

- `plaquettes-de-frein` + `optionId: 'front'` → `plaquettes-avant`
- `plaquettes-de-frein` + `optionId: 'rear'` → `plaquettes-arriere`
- `disques-de-frein` + `optionId: 'front'` → `disques-avant`
- `embrayage` → `embrayage`
- `climatisation` → `climatisation`
- etc.

### Clé de véhicule (vehicle_key)

Format : `MARQUE_MODELE_MOTORISATION_ANNEE`

Exemple : `PEUGEOT_2008_1.6_HDI_2018`

## API Endpoints

### POST `/api/price`

Récupère un prix (cache ou scraping).

**Request** :
```json
{
  "prestationId": "plaquettes-avant",
  "plate": "CC368ER",
  "vehicleInfo": {
    "brand": "Peugeot",
    "model": "2008",
    "engine": "1.6 HDI",
    "year": 2018
  },
  "selection": "plaquette-avant"
}
```

**Response** :
```json
{
  "success": true,
  "price": 79.00,
  "cached": false,
  "vehicleKey": "PEUGEOT_2008_1.6_HDI_2018"
}
```

## Durée de validité du cache

Par défaut : **24 heures**

Modifiable dans `api_price_cache.js` :
```javascript
const CACHE_VALIDITY_HOURS = 24; // Modifier ici
```

## Services exclus du scraping

Certains services ont des prix fixes et ne sont pas scrapés :
- `vidange`
- `filtre-a-huile`
- `filtre-a-air`
- `filtre-habitacle`
- `pneus-*` (tous les services pneus)

Ces services retournent une erreur indiquant qu'ils ne nécessitent pas de scraping.

## Gestion des erreurs

- **Cache expiré** : Relance automatiquement le scraping
- **Scraping échoué** : Retourne une erreur, le frontend affiche un message
- **Service non scrapable** : Retourne une erreur explicite

## Tests

Pour tester manuellement :

```bash
# Test direct du scraper
node scrape_midas_complete.js CC368ER https://www.midas.fr/devis/prestations/plaquettes-de-freins-avant-et-arriere plaquette-avant

# Test de l'API
curl -X POST http://localhost:3001/api/price \
  -H "Content-Type: application/json" \
  -d '{
    "prestationId": "plaquettes-avant",
    "plate": "CC368ER",
    "vehicleInfo": {
      "brand": "Peugeot",
      "model": "2008",
      "year": 2018
    },
    "selection": "plaquette-avant"
  }'
```

