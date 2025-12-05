# Test avec connexion 4G

## Pourquoi tester avec 4G ?

Si Midas vous a bloqué par IP, changer de connexion (passer du WiFi à la 4G) changera votre adresse IP et pourrait permettre de contourner le blocage.

## Comment tester

### Option 1: Utiliser le hotspot 4G de votre téléphone

1. **Activez le hotspot sur votre téléphone** (partage de connexion)
2. **Connectez votre Mac au hotspot 4G**
3. **Vérifiez votre nouvelle IP** :
   ```bash
   curl ifconfig.me
   ```
4. **Lancez le diagnostic** :
   ```bash
   node test_all_services_diagnostic.js GH878CD
   ```

### Option 2: Utiliser un proxy/VPN

Si vous avez un proxy ou VPN :

```bash
# Avec proxy HTTP
PROXY_SERVER=proxy.example.com PROXY_PORT=8080 node test_all_services_diagnostic.js GH878CD

# Avec authentification
PROXY_SERVER=proxy.example.com PROXY_PORT=8080 PROXY_USER=username PROXY_PASS=password node test_all_services_diagnostic.js GH878CD
```

## Interprétation des résultats

- **Si ça fonctionne avec 4G mais pas avec WiFi** : Vous êtes probablement bloqué par IP sur votre connexion WiFi
- **Si ça ne fonctionne pas avec les deux** : Le blocage est plus profond (peut-être basé sur d'autres facteurs comme le fingerprinting du navigateur)

## Solutions possibles

1. **Changer d'IP régulièrement** (4G, VPN, proxy rotatif)
2. **Utiliser des proxies rotatifs** pour changer d'IP à chaque requête
3. **Attendre quelques heures/jours** pour voir si le blocage est temporaire
4. **Utiliser un service de proxy rotatif** (comme Bright Data, Oxylabs, etc.)

