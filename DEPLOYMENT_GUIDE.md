## Déployer l’API de scraping en HTTPS

Ce guide explique **pas à pas** comment faire pointer ton domaine vers le VPS, configurer Nginx, obtenir un certificat Let’s Encrypt et mettre à jour tes applications Vercel. Tu peux suivre les étapes sans rien connaître à l’hébergement : il suffit de copier/coller les commandes.

---

### 0. Prérequis

- Un domaine déjà acheté (ex. `ocazcar.fr`) et la possibilité de créer des enregistrements DNS (chez OVH, Ionos, Hostinger, etc.).
- L’adresse IPv4 de ton VPS : `31.97.55.30`.
- Accès SSH au serveur (`ssh root@31.97.55.30`).

---

### 1. Créer le sous-domaine `scraper.ocazcar.fr`

1. Connecte-toi sur le site de ton registrar (là où tu as acheté `ocazcar.fr`).
2. Ouvre la section **DNS / Zone DNS**.
3. Ajoute un enregistrement de type **A** :
   - **Nom / Sous-domaine** : `scraper`
   - **Cible / Adresse IPv4** : `31.97.55.30`
4. Enregistre.

> 💡 Le changement peut prendre jusqu’à 10 minutes (parfois 1 h). Pour vérifier :
> ```bash
> nslookup scraper.ocazcar.fr
> ```
> Tu dois voir l’adresse `31.97.55.30`. Tant que ce n’est pas le cas, attends un peu.

---

### 2. Copier la configuration Nginx sur le VPS

1. Connecte-toi en SSH :
   ```bash
   ssh root@31.97.55.30
   ```
2. Crée la configuration du site :
   ```bash
   cat <<'EOF' >/etc/nginx/sites-available/scraper
   server {
       server_name scraper.ocazcar.fr;

       location / {
           proxy_pass http://127.0.0.1:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   EOF
   ```
3. Active le site et recharge Nginx :
   ```bash
   ln -s /etc/nginx/sites-available/scraper /etc/nginx/sites-enabled/scraper
   nginx -t && systemctl reload nginx
   ```

Si la commande `nginx -t` affiche `ok`, tout est bon.

---

### 3. Installer (une seule fois) Certbot et obtenir le certificat HTTPS

1. Toujours sur le serveur :
   ```bash
   apt install -y certbot python3-certbot-nginx
   ```
2. Lance Certbot :
   ```bash
   certbot --nginx -d scraper.ocazcar.fr
   ```
   - Il te demande un email : tape `ocazcar21@gmail.com` (ou celui que tu veux).
   - Tape `A` pour accepter les conditions.
   - Tape `Y` si tu veux recevoir les emails de Let’s Encrypt (ou `N`).
   - Quand il propose **Redirect or No Redirect**, choisis `2` (= forcer le HTTPS).

Si tout se passe bien, Certbot affiche `Congratulations!` et crée automatiquement les tâches de renouvellement.

---

### 4. Vérifier que l’API répond en HTTPS

Toujours depuis le serveur (ou depuis ton Mac) :
```bash
curl https://scraper.ocazcar.fr/health
```
Tu dois recevoir :
```json
{"status":"ok", ...}
```

À ce stade, le navigateur peut appeler l’API sans erreur “contenu non sécurisé”.

---

### 5. Mettre à jour les variables d’environnement sur Vercel

Tu dois faire la même manipulation sur **SITE OCAZCAR** et **SYSTEME OCAZCAR**.

1. Va dans Vercel → ton projet → **Settings → Environment Variables**.
2. Ajoute (ou modifie) la variable :
   - **Name** : `VITE_SCRAPER_API_URL`
   - **Value** : `https://scraper.ocazcar.fr`
   - **Environment** : `Production` (et `Preview` si tu veux tester depuis des branches).
3. Clique sur **Save**.
4. Reviens sur l’onglet **Deployments** et clique sur **Redeploy** (ou repousse un commit).

Après le redeploy, ouvre ton site, lance un devis, puis dans l’onglet **Network** du navigateur tu dois voir des appels vers `https://scraper.ocazcar.fr/api/...`.

---

### 6. Résumé des commandes à copier/coller

```bash
# Sur le serveur
ssh root@31.97.55.30
cat <<'EOF' >/etc/nginx/sites-available/scraper
server {
    server_name scraper.ocazcar.fr;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
ln -s /etc/nginx/sites-available/scraper /etc/nginx/sites-enabled/scraper
nginx -t && systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d scraper.ocazcar.fr
curl https://scraper.ocazcar.fr/health
```

Ensuite, mets à jour `VITE_SCRAPER_API_URL` dans Vercel (valeur : `https://scraper.ocazcar.fr`) et redeploie.

---

Si tu suis exactement ces étapes, ton frontend ne parlera plus jamais à `localhost`, tout passera par ton VPS sécurisé en HTTPS. Dès que tu as fini, on pourra tester ensemble en direct.

