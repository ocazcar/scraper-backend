# Instructions pour tester le scraper Midas avec Safari WebKit

## 🚀 Installation

### Étape 1 : Installer les dépendances
```bash
cd SCRAPER_BACKEND
npm install
```

### Étape 2 : Installer Playwright WebKit (Safari)
```bash
npx playwright install webkit
```

Cela va télécharger le moteur WebKit (Safari) pour Playwright.

## 🧪 Test

### Option 1 : Test direct avec Node.js
```bash
node test_midas_playwright.js EV404YY plaquettes-avant
```

### Option 2 : Test avec npm script
```bash
npm run test-midas-safari EV404YY plaquettes-avant
```

### Paramètres
- **Premier paramètre** : La plaque d'immatriculation (ex: `EV404YY`)
- **Deuxième paramètre** : Le service (ex: `plaquettes-avant` ou `plaquettes-arriere`)

## 📊 Ce qui va se passer

1. ✅ Le navigateur Safari WebKit s'ouvre (visible)
2. ✅ Navigation vers la page de devis Midas
3. ✅ Acceptation des cookies (si nécessaire)
4. ✅ Clic sur "Modifier"
5. ✅ Saisie de la plaque
6. ✅ Clic sur "Continuer"
7. ✅ Sélection du service (Plaquettes avant/arrière)
8. ✅ Clic sur "Calculer mon devis"
9. ✅ Extraction du prix
10. ✅ Affichage du résultat

## 📸 Captures d'écran

Le script prend automatiquement des captures d'écran :
- `midas_after_plate.png` : Après la saisie de la plaque
- `midas_devis_result.png` : Résultat du devis avec le prix

## ✅ Résultat attendu

Si tout fonctionne, vous verrez :
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

## 🔍 Debug

Si le test échoue :
1. Regardez les captures d'écran pour voir où ça bloque
2. Vérifiez les logs dans la console
3. Le navigateur reste ouvert 10 secondes pour que vous puissiez voir ce qui s'est passé

## ⚠️ Notes importantes

- Le navigateur s'ouvre en mode visible (pas headless) pour que vous puissiez voir ce qui se passe
- Safari WebKit ne demande généralement pas les cookies (c'est pour ça qu'on l'utilise)
- Le script attend entre chaque étape pour laisser le temps à la page de charger

## 🐛 Problèmes courants

### "webkit not found"
```bash
npx playwright install webkit
```

### "Permission denied"
Assurez-vous d'avoir les permissions d'exécution :
```bash
chmod +x test_midas_playwright.js
```

### Le script ne trouve pas les boutons
- Vérifiez les captures d'écran
- Le site Midas a peut-être changé sa structure
- Il faudra peut-être ajuster les sélecteurs dans le script

