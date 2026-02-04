# Comment accéder aux permissions Nanonbanana

## 🔐 Résoudre l'erreur 401 "You do not have access permissions"

### Étape 1 : Accéder au Dashboard Nanonbanana

1. **Va sur le dashboard** : https://nanobananaapi.ai/dashboard
2. **Connecte-toi** avec ton compte
3. Si tu n'as pas de compte, **crée-en un** sur https://nanobananaapi.ai

### Étape 2 : Vérifier la clé API

1. **Va sur la page de gestion des clés API** : https://nanobananaapi.ai/api-key
2. **Vérifie que ta clé API est active** :
   - La clé doit être visible dans la liste
   - Le statut doit être "Active" ou "Enabled"
   - Si la clé est "Inactive" ou "Disabled", **active-la** ou **génère-en une nouvelle**

### Étape 3 : Whitelist ton adresse IP

L'erreur 401 peut venir d'une IP non autorisée. Voici comment ajouter ton IP à la whitelist :

#### 3.1 Trouver ton adresse IP publique

**Option A : Via le terminal**
```bash
curl ifconfig.me
```

**Option B : Via un site web**
- Va sur https://whatismyipaddress.com
- Copie ton **IPv4 Address**

#### 3.2 Ajouter l'IP à la whitelist

1. **Va sur** : https://nanobananaapi.ai/api-key
2. **Trouve ta clé API** dans le tableau
3. **Cherche la colonne "Whitelist"** ou **"Add Whitelist"** ou **"IP Whitelist"**
4. **Clique sur le bouton** (peut être un bouton "Add", "Manage", ou une icône "+")
5. **Entre ton adresse IP** (ex: `128.79.131.21`)
6. **Sauvegarde** les changements

### Étape 4 : Vérifier les crédits

L'erreur 401 peut aussi venir de crédits insuffisants :

1. **Va sur** : https://nanobananaapi.ai/dashboard
2. **Cherche la section "Credits"** ou **"Billing"**
3. **Vérifie que tu as des crédits disponibles**
4. Si tu n'as pas de crédits, **achète-en** via la section "Billing" ou "Credits"

### Étape 5 : Vérifier les permissions de la clé API

1. **Va sur** : https://nanobananaapi.ai/api-key
2. **Clique sur ta clé API** pour voir les détails
3. **Vérifie les permissions** :
   - La clé doit avoir la permission **"Generate Images"** ou **"Image Generation"**
   - La clé doit avoir la permission **"Image-to-Image"** ou **"IMAGETOIAMGE"**
4. Si les permissions ne sont pas activées, **active-les** ou **génère une nouvelle clé** avec les bonnes permissions

### Étape 6 : Tester la clé API

Utilise l'endpoint de test que nous avons créé :

1. **Ouvre ton navigateur**
2. **Va sur** : http://localhost:3000/api/test-nanonbanana
3. **Vérifie la réponse** :
   - Si `success: true` → La clé fonctionne ✅
   - Si `has401Errors: true` → Problème d'authentification ❌
   - Si `has403Errors: true` → Problème de permissions/IP ❌

## 🔍 Où trouver les permissions dans l'interface

### Dans le Dashboard

1. **Dashboard principal** : https://nanobananaapi.ai/dashboard
   - Section "API Keys" ou "Clés API"
   - Section "Permissions" ou "Permissions"
   - Section "Whitelist" ou "Liste blanche"

### Dans la page API Key

1. **Page API Key** : https://nanobananaapi.ai/api-key
   - Tableau avec toutes tes clés API
   - Colonnes : "Name", "Key", "Status", "Permissions", "Whitelist", "Actions"
   - Clique sur une clé pour voir les détails

### Sections à vérifier

- ✅ **Status** : Doit être "Active"
- ✅ **Permissions** : Doit inclure "Generate Images" ou "IMAGETOIAMGE"
- ✅ **Whitelist** : Doit contenir ton adresse IP
- ✅ **Credits** : Doit être > 0

## 🐛 Dépannage

### Erreur 401 persistante

1. **Vérifie que la clé API est correcte** dans `.env.local`
2. **Vérifie que l'IP est whitelistée**
3. **Vérifie que tu as des crédits**
4. **Génère une nouvelle clé API** si nécessaire
5. **Contacte le support** : support@nanobananaapi.ai

### La clé API n'apparaît pas

1. **Vérifie que tu es connecté** au bon compte
2. **Rafraîchis la page** (Cmd+R ou F5)
3. **Vérifie que tu es sur** https://nanobananaapi.ai/api-key (pas un autre domaine)

### Impossible d'ajouter l'IP à la whitelist

1. **Vérifie que tu es connecté** au compte qui possède la clé
2. **Vérifie que la clé est active**
3. **Essaie de générer une nouvelle clé** avec les permissions nécessaires
4. **Contacte le support** si le problème persiste

## 📞 Support

Si tu ne trouves pas les permissions ou si l'erreur persiste :

- **Email** : support@nanobananaapi.ai
- **Dashboard** : https://nanobananaapi.ai/dashboard
- **Documentation** : https://docs.nanobananaapi.ai

## ✅ Checklist rapide

- [ ] Clé API active sur https://nanobananaapi.ai/api-key
- [ ] IP whitelistée dans les paramètres de la clé
- [ ] Crédits disponibles dans le dashboard
- [ ] Permissions "Generate Images" activées
- [ ] Clé API correcte dans `.env.local`
- [ ] Serveur redémarré après modification de `.env.local`


