# Configuration des Services et Scraping

## 📋 Fichiers

### `services_config.json`
Fichier de configuration qui liste toutes les prestations de l'atelier avec leur correspondance Midas.

**Structure d'un service :**
```json
{
  "id": "plaquettes-avant",
  "name": "Plaquettes de frein avant",
  "midasService": "plaquettes-avant",
  "category": "freinage",
  "description": "Remplacement des plaquettes de frein avant"
}
```

**Catégories disponibles :**
- `freinage` : Services de freinage
- `suspension` : Services de suspension
- `entretien` : Entretien et maintenance
- `transmission` : Transmission
- `electricite` : Électricité et électronique
- `pneus` : Pneus et roues
- `visibilite` : Visibilité et éclairage
- `moteur` : Moteur
- `diagnostic` : Diagnostic

### `scrape_all_services.js`
Script pour scraper tous les prix de toutes les prestations pour une plaque donnée.

## 🚀 Utilisation

### Tester un service individuellement
```bash
node test_plate_input_only.js EV404YY plaquettes-avant
```

### Scraper tous les services d'un coup
```bash
node scrape_all_services.js EV404YY
```

Le script va :
1. Parcourir tous les services définis dans `services_config.json`
2. Scraper le prix pour chaque service
3. Sauvegarder les résultats dans un fichier JSON : `scraping_results_[PLAQUE]_[DATE].json`

**⚠️ Attention :** Le scraping de tous les services peut prendre plusieurs minutes (environ 5 secondes par service).

## 📊 Résultats

Le fichier JSON de résultats contient :
```json
[
  {
    "serviceId": "plaquettes-avant",
    "serviceName": "Plaquettes de frein avant",
    "category": "freinage",
    "price": 89.90,
    "url": "https://www.midas.fr/...",
    "success": true,
    "scrapedAt": "2025-01-20T10:30:00.000Z"
  },
  {
    "serviceId": "plaquettes-arriere",
    "serviceName": "Plaquettes de frein arrière",
    "category": "freinage",
    "success": false,
    "error": "Service non trouvé sur la page",
    "scrapedAt": "2025-01-20T10:30:05.000Z"
  }
]
```

## ➕ Ajouter un nouveau service

Pour ajouter un nouveau service, éditez `services_config.json` et ajoutez une entrée dans le tableau `services` :

```json
{
  "id": "nouveau-service",
  "name": "Nom du service",
  "midasService": "service-midas-correspondant",
  "category": "categorie",
  "description": "Description du service"
}
```

**Important :** Le champ `midasService` doit correspondre au service tel qu'il apparaît sur le site Midas (ex: `plaquettes-avant`, `plaquettes-arriere`, etc.).

## 🔧 Services actuellement configurés

- **Freinage :** Plaquettes avant/arrière, Disques avant/arrière, Disques et plaquettes
- **Suspension :** Amortisseurs avant/arrière/complet
- **Entretien :** Vidange, Filtres (huile, air, habitacle)
- **Transmission :** Embrayage
- **Électricité :** Batterie
- **Pneus :** Pneus avant/arrière/complet, Réparation crevaison
- **Visibilité :** Balais d'essuie-glace
- **Moteur :** Bougies, Courroies (distribution, accessoires)
- **Diagnostic :** Diagnostic électronique

## 📝 Notes

- Le scraping se fait avec Playwright (WebKit/Safari)
- Chaque service prend environ 5 secondes à scraper
- Les résultats sont sauvegardés automatiquement dans un fichier JSON
- En cas d'erreur, le service est marqué comme échoué mais le script continue avec les autres services

