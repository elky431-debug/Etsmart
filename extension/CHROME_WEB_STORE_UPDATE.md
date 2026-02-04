# 📤 Mettre à jour l'extension sur Chrome Web Store

## ✅ Ce qui a été corrigé dans la v1.0.1

- ✅ Toutes les références à `localhost:3000` ont été remplacées par `https://etsmart.app`
- ✅ L'extension utilise maintenant uniquement l'URL de production
- ✅ Nettoyage automatique du storage si une ancienne valeur localhost est détectée
- ✅ Version incrémentée à **1.0.1**

---

## 📦 Étape 1 : Créer le package ZIP

### Option A : Utiliser le script automatique

```bash
cd extension
./package-extension.sh
```

Cela créera un fichier `etsmart-extension-v1.0.1.zip` dans le dossier `extension/`.

### Option B : Créer le ZIP manuellement

1. Créez un nouveau dossier (ex: `etsmart-extension-v1.0.1`)
2. Copiez uniquement ces fichiers dans ce dossier :
   - `manifest.json`
   - `background.js`
   - `content-script.js`
   - `popup.html`
   - `icon16.png` (si disponible)
3. Créez un ZIP de ce dossier (pas du dossier parent !)
4. Renommez-le en `etsmart-extension-v1.0.1.zip`

**⚠️ IMPORTANT :** Ne pas inclure :
- Les fichiers `.ts` (sources TypeScript)
- `node_modules/`
- `.git/`
- Les fichiers de documentation (`.md`)
- `tsconfig.json`
- `types.ts` ou `types.js`

---

## 📤 Étape 2 : Mettre à jour sur Chrome Web Store

1. **Connectez-vous au Chrome Web Store Developer Dashboard**
   - Allez sur : https://chrome.google.com/webstore/devconsole
   - Connectez-vous avec votre compte Google

2. **Trouvez votre extension**
   - Cliquez sur l'extension "Etsmart - Analyseur de Boutiques Etsy"
   - Vous devriez voir le statut "En attente de révision" ou "Rejetée"

3. **Mettre à jour le package**
   - Cliquez sur **"Package"** ou **"Upload new package"**
   - Téléversez le nouveau fichier `etsmart-extension-v1.0.1.zip`
   - Chrome Web Store détectera automatiquement la nouvelle version (1.0.1)

4. **Mettre à jour les notes de version** (recommandé)
   - Allez dans l'onglet **"Store listing"** ou **"Package"**
   - Dans la section **"What's new"** ou **"Release notes"**, ajoutez :
     ```
     Version 1.0.1 - Correction des URLs
     - Correction : L'extension utilise maintenant l'URL de production (etsmart.app) au lieu de localhost
     - Amélioration : Nettoyage automatique des anciennes configurations
     ```

5. **Soumettre pour révision**
   - Cliquez sur **"Submit for review"** ou **"Publier"**
   - Chrome Web Store va re-examiner votre extension

---

## 📝 Notes importantes pour les reviewers

Si Chrome Web Store vous demande des clarifications, vous pouvez mentionner :

> "Cette mise à jour corrige un problème où l'extension pointait vers une URL de développement (localhost) au lieu de l'URL de production. L'extension communique maintenant uniquement avec https://etsmart.app, qui est notre service SaaS en production."

---

## ⏱️ Délais de révision

- **Première soumission** : 1-3 jours ouvrables
- **Mise à jour** : Généralement plus rapide (quelques heures à 1 jour)
- **Re-soumission après rejet** : 1-2 jours ouvrables

---

## ✅ Checklist avant soumission

- [ ] Version incrémentée dans `manifest.json` (1.0.1)
- [ ] Aucune référence à `localhost` dans les fichiers `.js`
- [ ] Package ZIP créé avec uniquement les fichiers nécessaires
- [ ] ZIP testé localement (charger dans Chrome en mode développeur)
- [ ] Notes de version ajoutées
- [ ] Extension soumise pour révision

---

## 🧪 Tester le package avant soumission

Avant de soumettre, testez le ZIP :

1. Supprimez l'extension actuelle de Chrome
2. Allez sur `chrome://extensions/`
3. Activez le "Mode développeur"
4. Cliquez sur "Charger l'extension non empaquetée"
5. **Sélectionnez le contenu du ZIP décompressé** (pas le ZIP lui-même)
6. Testez que l'extension fonctionne correctement
7. Vérifiez dans la console que toutes les URLs pointent vers `etsmart.app`

---

## 🆘 Si l'extension est rejetée

Si Chrome Web Store rejette votre extension :

1. **Lisez attentivement les raisons du rejet** dans le dashboard
2. **Corrigez les problèmes** mentionnés
3. **Incrémentez la version** (1.0.2, 1.0.3, etc.)
4. **Créez un nouveau package** et re-soumettez

Les raisons courantes de rejet :
- Permissions excessives (vérifiez que vous n'avez que ce qui est nécessaire)
- Violation des politiques (pas de scraping agressif, respect des ToS d'Etsy)
- Problèmes de sécurité (utilisez HTTPS uniquement)

---

## 📞 Support

Si vous avez des questions ou des problèmes :
- Documentation Chrome Web Store : https://developer.chrome.com/docs/webstore/
- Forum des développeurs : https://groups.google.com/a/chromium.org/g/chromium-extensions

