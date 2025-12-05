# Instructions pour tester le scraper Midas

## Installation

1. Installer les dépendances :
```bash
cd SCRAPER_BACKEND
npm install
```

## Test simple

### Test avec une plaque d'immatriculation

```bash
# Test avec une plaque (les infos véhicule seront récupérées automatiquement)
node test_midas_scraper.js AB-123-CD

# Test avec une plaque et un service spécifique
node test_midas_scraper.js AB-123-CD plaquettes-de-frein-avant
```

### Test avec npm

```bash
npm test AB-123-CD
```

## Ce que fait le script

1. **Récupère les infos du véhicule** depuis l'API de plaque d'immatriculation
   - Si la plaque n'est pas trouvée, utilise des valeurs par défaut (Renault Clio 2020)

2. **Ouvre un navigateur** (visible, pas en mode headless pour voir ce qui se passe)

3. **Recherche sur Midas** avec la requête : "plaquettes de frein avant [Marque] [Modèle]"

4. **Accepte les cookies** automatiquement si nécessaire

5. **Cherche le prix** sur la page de résultats

6. **Navigue vers la page produit** pour trouver le prix avec installation

7. **Prend des captures d'écran** pour debug :
   - `midas_search_result.png` : Page de résultats
   - `midas_product_page.png` : Page produit

8. **Affiche le résultat** :
   - ✅ Prix trouvé : X€
   - ✅ Prix avec installation : Y€
   - ❌ Erreur si échec

## Résultat attendu

Si le scraping fonctionne, vous devriez voir :
```
✅ TEST RÉUSSI !
   Prix: 79.90€
   Prix avec installation: 136.85€
```

Si ça ne fonctionne pas, vous verrez :
```
❌ TEST ÉCHOUÉ
   Erreur: [description de l'erreur]
```

## Vérification

- Le navigateur s'ouvre et vous pouvez voir ce qui se passe
- Des captures d'écran sont sauvegardées pour analyser les problèmes
- Le script attend 5 secondes avant de fermer le navigateur pour que vous puissiez voir

## Problèmes possibles

1. **"Prix non trouvé"** : Les sélecteurs CSS peuvent avoir changé sur le site Midas
   - Vérifiez les captures d'écran
   - Il faudra peut-être ajuster les sélecteurs dans le script

2. **"Erreur de navigation"** : Le site Midas peut bloquer les robots
   - Vérifiez si vous êtes bloqué par un captcha
   - Le site peut avoir détecté l'automatisation

3. **"Timeout"** : La page met trop de temps à charger
   - Augmentez le timeout dans le script
   - Vérifiez votre connexion internet

## Prochaines étapes

Si le test fonctionne :
- ✅ On peut intégrer ça dans le site
- ✅ On peut ajouter le cache Supabase
- ✅ On peut automatiser le processus

Si le test échoue :
- ❌ Il faudra trouver une autre méthode
- ❌ Peut-être utiliser une API officielle si disponible
- ❌ Ou scraper différemment (avec plus de délais, proxies, etc.)

