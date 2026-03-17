# 📤 Guide de soumission - Version 1.0.2

## ✅ Checklist avant soumission

- [x] Version incrémentée à **1.0.2** dans `manifest.json`
- [x] Page de test créée (`/test-extension`)
- [x] Extension modifiée pour supporter la page de test
- [ ] Package ZIP créé
- [ ] ZIP testé localement
- [ ] Notes de version préparées

---

## 📦 Étape 1 : Créer le package ZIP

### Option A : Utiliser le script automatique

```bash
cd extension
chmod +x package-extension.sh
./package-extension.sh
```

Cela créera un fichier `etsmart-extension-v1.0.2.zip` dans le dossier `extension/`.

### Option B : Créer le ZIP manuellement

1. Créez un nouveau dossier (ex: `etsmart-extension-v1.0.2`)
2. Copiez **uniquement** ces fichiers dans ce dossier :
   - ✅ `manifest.json`
   - ✅ `background.js`
   - ✅ `content-script.js`
   - ✅ `popup.html`
   - ✅ `icon16.png` (si disponible)
3. Créez un ZIP de ce dossier (pas du dossier parent !)
4. Renommez-le en `etsmart-extension-v1.0.2.zip`

**⚠️ IMPORTANT :** Ne pas inclure :
- ❌ Les fichiers `.ts` (sources TypeScript)
- ❌ `node_modules/`
- ❌ `.git/`
- ❌ Les fichiers de documentation (`.md`)
- ❌ `tsconfig.json`
- ❌ `types.ts` ou `types.js`

---

## 🧪 Étape 2 : Tester le package localement

**AVANT** de soumettre, testez le ZIP :

1. Supprimez l'extension actuelle de Chrome (si installée)
2. Allez sur `chrome://extensions/`
3. Activez le **"Mode développeur"** (en haut à droite)
4. Cliquez sur **"Charger l'extension non empaquetée"**
5. **Sélectionnez le contenu du ZIP décompressé** (pas le ZIP lui-même)
6. Testez que l'extension fonctionne correctement :
   - Allez sur une page Etsy
   - Vérifiez que l'extension apparaît
   - Testez le scraping
7. Vérifiez dans la console que toutes les URLs pointent vers `etsmart.app`

---

## 📤 Étape 3 : Mettre à jour sur Chrome Web Store

### 1. Connectez-vous au Dashboard

- Allez sur : https://chrome.google.com/webstore/devconsole
- Connectez-vous avec votre compte Google (`lucas.mtes07`)

### 2. Trouvez votre extension

- Cliquez sur **"Éléments"** dans le menu de gauche
- Cliquez sur **"Etsmart - Analyseur de Boutiques Etsy"**
- Vous devriez voir le statut **"En attente d'examen"**

### 3. Mettre à jour le package

- Cliquez sur l'onglet **"Package"** ou **"Packaging"**
- Cliquez sur **"Upload new package"** ou **"Téléverser un nouveau package"**
- Téléversez le fichier `etsmart-extension-v1.0.2.zip`
- Chrome Web Store détectera automatiquement la nouvelle version (1.0.2)

### 4. Mettre à jour les notes de version

Dans l'onglet **"Store listing"** ou **"Package"**, dans la section **"What's new"** ou **"Release notes"**, ajoutez :

```
Version 1.0.2 - Page de test pour les reviewers

Nouveautés :
- Ajout d'une page de test dédiée pour faciliter la validation par Google
- Support de la redirection automatique vers la page de test depuis l'extension
- Interface simplifiée pour les testeurs sans nécessiter d'authentification

Améliorations :
- Meilleure gestion des événements de l'extension
- Amélioration de l'affichage des résultats d'analyse

URL de test pour les reviewers : https://etsmart.app/test-extension
```

### 5. Informations importantes pour les reviewers

Dans la section **"Additional information"** ou **"Notes for reviewers"**, vous pouvez ajouter :

```
Cette version inclut une page de test accessible à https://etsmart.app/test-extension qui permet aux reviewers Google de tester l'extension complètement sans avoir besoin de créer un compte ou de s'abonner. Cette page est uniquement accessible via le lien direct et n'apparaît pas dans la navigation normale du site.

Pour tester :
1. Aller sur https://etsmart.app/test-extension
2. Entrer une URL de produit Etsy (ex: https://www.etsy.com/listing/...)
3. Cliquer sur "Analyser le produit"
4. Les résultats s'afficheront immédiatement

Ou utiliser l'extension directement sur une page Etsy, elle redirigera automatiquement vers la page de test avec les résultats.
```

### 6. Soumettre pour révision

- Cliquez sur **"Submit for review"** ou **"Soumettre pour examen"**
- Chrome Web Store va re-examiner votre extension

---

## ⏱️ Délais de révision

- **Mise à jour** : Généralement plus rapide (quelques heures à 1 jour)
- **Re-soumission après rejet** : 1-2 jours ouvrables

---

## 📝 Notes importantes

### Pourquoi cette version ?

Cette version 1.0.2 ajoute une page de test dédiée qui permet aux reviewers Google de tester l'extension sans avoir besoin de :
- Créer un compte
- S'abonner
- Se connecter

Cela facilite grandement le processus de validation et répond aux exigences de Google pour tester les extensions.

### Sécurité

- La page de test n'est pas indexée par les moteurs de recherche
- Aucune authentification requise (uniquement pour les tests)
- Les données ne sont pas sauvegardées en base de données
- Utilisation uniquement pour les tests Google

---

## 🆘 Si l'extension est rejetée

Si Chrome Web Store rejette votre extension :

1. **Lisez attentivement les raisons du rejet** dans le dashboard
2. **Corrigez les problèmes** mentionnés
3. **Incrémentez la version** (1.0.3, 1.0.4, etc.)
4. **Créez un nouveau package** et re-soumettez

Les raisons courantes de rejet :
- Permissions excessives (vérifiez que vous n'avez que ce qui est nécessaire)
- Violation des politiques (pas de scraping agressif, respect des ToS d'Etsy)
- Problèmes de sécurité (utilisez HTTPS uniquement)
- Manque d'informations pour tester (c'est pourquoi on ajoute la page de test)

---

## ✅ Résumé des fichiers à inclure dans le ZIP

```
etsmart-extension-v1.0.2/
├── manifest.json          ✅ REQUIS
├── background.js          ✅ REQUIS
├── content-script.js      ✅ REQUIS
├── popup.html             ✅ REQUIS
└── icon16.png             ⚠️  OPTIONNEL (mais recommandé)
```

**Taille attendue** : ~50-100 KB (sans les icônes)

---

## 🎯 URL de test à fournir aux reviewers

**Page de test** : https://etsmart.app/test-extension

Cette URL doit être mentionnée dans les notes pour les reviewers pour qu'ils puissent facilement tester l'extension.



