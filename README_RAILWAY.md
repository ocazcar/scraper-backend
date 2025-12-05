# Déploiement sur Railway - Guide Rapide

## 🚀 Déploiement en 5 minutes

### 1. Créer un compte Railway
- Allez sur [railway.app](https://railway.app)
- Créez un compte (gratuit, avec $5 de crédit/mois)

### 2. Créer un nouveau projet
- Cliquez sur "New Project"
- Sélectionnez "Deploy from GitHub repo"
- Autorisez Railway à accéder à votre GitHub
- Sélectionnez votre repository
- Railway détectera automatiquement le dossier `SCRAPER_BACKEND`

### 3. Configurer les variables d'environnement
Dans Railway, allez dans "Variables" et ajoutez :

```
PORT=3001
FRONTEND_URL=https://votre-domaine-vercel.com
```

Si vous utilisez Supabase pour le cache :
```
SUPABASE_URL=votre_url_supabase
SUPABASE_KEY=votre_cle_supabase
```

### 4. Déployer
- Railway va automatiquement :
  1. Installer les dépendances (`npm install`)
  2. Installer Playwright (`npx playwright install --with-deps`)
  3. Démarrer le serveur (`npm start`)

### 5. Récupérer l'URL
- Une fois déployé, Railway vous donnera une URL comme :
  `https://votre-projet.railway.app`
- Copiez cette URL

### 6. Configurer le frontend (Vercel)
Dans votre projet Vercel, ajoutez/modifiez la variable d'environnement :

```
VITE_SCRAPER_API_URL=https://votre-projet.railway.app
```

Puis redéployez votre frontend sur Vercel.

## ✅ C'est tout !

Votre backend est maintenant déployé et accessible depuis votre frontend Vercel.

## 💰 Coûts

- **Gratuit** : $5 de crédit/mois (environ 500 heures de runtime)
- Si vous dépassez : ~$5-10/mois selon l'utilisation

## 🔍 Vérifier que ça fonctionne

1. Allez sur `https://votre-projet.railway.app/health`
2. Vous devriez voir : `{"status":"ok","timestamp":"..."}`

## 📊 Monitoring

Railway vous donne accès à :
- Logs en temps réel
- Métriques d'utilisation
- Historique des déploiements

## 🐛 Dépannage

### Le déploiement échoue
- Vérifiez les logs dans Railway
- Assurez-vous que `package.json` est correct
- Vérifiez que Playwright peut s'installer

### Erreur CORS
- Vérifiez que `FRONTEND_URL` est bien configuré dans Railway
- Vérifiez que l'URL correspond exactement à votre domaine Vercel (avec https://)

### Le scraping ne fonctionne pas
- Vérifiez les logs dans Railway
- Assurez-vous que Playwright est bien installé
- Testez l'endpoint `/health` d'abord

