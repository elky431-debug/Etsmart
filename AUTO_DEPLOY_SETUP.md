# 🚀 Configuration du Déploiement Automatique Netlify

## ✅ État Actuel

Votre site Netlify est **déjà connecté** au repository GitHub :
- **Repository** : `https://github.com/elky431-debug/Etsmart`
- **Site Netlify** : `etsmart` (ID: `6b1db453-5ad9-4ea3-a025-ce9d134b442f`)
- **URL** : https://etsmart.app

## 🔄 Activer le Déploiement Automatique

Le déploiement automatique devrait déjà être activé par défaut quand un repository est connecté. Voici comment vérifier et activer :

### Option 1 : Via l'Interface Netlify (Recommandé)

1. **Allez sur** : https://app.netlify.com/projects/etsmart/settings/deploys

2. **Vérifiez la section "Build & deploy"** :
   - **Continuous Deployment** : Doit être activé
   - **Branch to deploy** : `main` (ou `master`)
   - **Build command** : `npm run build`
   - **Publish directory** : `.next` (géré automatiquement par le plugin Next.js)

3. **Si le déploiement automatique n'est pas activé** :
   - Cliquez sur **"Link to Git provider"**
   - Sélectionnez **GitHub**
   - Autorisez Netlify à accéder à votre repository
   - Sélectionnez le repository `elky431-debug/Etsmart`
   - Sélectionnez la branche `main`
   - Cliquez sur **"Save"**

### Option 2 : Via Netlify CLI

```bash
# Vérifier la configuration actuelle
npx netlify status

# Si nécessaire, reconnecter le repository
npx netlify link --repo https://github.com/elky431-debug/Etsmart
```

## ✅ Vérification

Pour vérifier que le déploiement automatique fonctionne :

1. **Faites un petit changement** dans votre code local
2. **Commitez et poussez** :
   ```bash
   git add .
   git commit -m "Test déploiement automatique"
   git push
   ```
3. **Vérifiez sur Netlify** :
   - Allez sur https://app.netlify.com/projects/etsmart/deploys
   - Un nouveau déploiement devrait apparaître automatiquement dans les 1-2 minutes

## 🔔 Notifications

Vous pouvez configurer des notifications pour être alerté des déploiements :

1. **Netlify** → Votre site → **Site settings**
2. **Build & deploy** → **Deploy notifications**
3. Configurez les notifications par email, Slack, etc.

## 📋 Configuration Recommandée

### Build Settings

- **Build command** : `npm run build`
- **Publish directory** : `.next` (géré par `@netlify/plugin-nextjs`)
- **Node version** : `20.x` (ou la version que vous utilisez)

### Deploy Settings

- **Branch to deploy** : `main`
- **Deploy previews** : Activé (pour les Pull Requests)
- **Production branch** : `main`

## 🎯 Test du Déploiement Automatique

Pour tester que tout fonctionne :

```bash
# 1. Faire un petit changement
echo "# Test auto-deploy" >> README.md

# 2. Commiter et pousser
git add README.md
git commit -m "Test: Vérification déploiement automatique"
git push

# 3. Vérifier sur Netlify (dans 1-2 minutes)
# https://app.netlify.com/projects/etsmart/deploys
```

## 🔍 Dépannage

### Le déploiement ne se déclenche pas automatiquement

1. **Vérifiez que le repository est bien connecté** :
   - Netlify → Site settings → Build & deploy → Continuous Deployment
   - Le repository GitHub doit être affiché

2. **Vérifiez les webhooks GitHub** :
   - GitHub → Repository → Settings → Webhooks
   - Il doit y avoir un webhook Netlify configuré

3. **Vérifiez les permissions** :
   - Netlify doit avoir accès au repository GitHub
   - Vérifiez dans GitHub → Settings → Applications → Authorized OAuth Apps

### Le déploiement échoue

1. **Vérifiez les logs** :
   - Netlify → Deploys → Sélectionnez le déploiement → Voir les logs

2. **Vérifiez les variables d'environnement** :
   - Toutes les variables doivent être configurées sur Netlify

3. **Vérifiez le build local** :
   - `npm run build` doit passer sans erreur

## 📚 Documentation

- [Netlify Continuous Deployment](https://docs.netlify.com/site-deploys/create-deploys/)
- [Netlify Build Settings](https://docs.netlify.com/configure-builds/overview/)

---

**✅ Une fois configuré, chaque `git push` sur la branche `main` déclenchera automatiquement un déploiement sur Netlify !**



