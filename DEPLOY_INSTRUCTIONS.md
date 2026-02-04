# 🚀 Instructions de Déploiement Netlify - Etsmart

## ✅ État Actuel

- ✅ **Build** : Passe sans erreur
- ✅ **Configuration Netlify** : Site déjà configuré (ID: `6b1db453-5ad9-4ea3-a025-ce9d134b442f`)
- ✅ **netlify.toml** : Configuré correctement
- ✅ **Code** : Prêt pour le déploiement

## 🎯 Déploiement Immédiat

### Option 1 : Via Netlify CLI (Rapide)

```bash
# 1. Se connecter à Netlify (si pas déjà connecté)
netlify login

# 2. Lier au site existant
netlify link --id 6b1db453-5ad9-4ea3-a025-ce9d134b442f

# 3. Déployer
netlify deploy --prod
```

### Option 2 : Via Git Push (Automatique)

```bash
# 1. Commiter les changements
git add .
git commit -m "Préparation déploiement Netlify - Version complète"
git push

# 2. Netlify déploiera automatiquement si le repository est connecté
```

### Option 3 : Via l'Interface Netlify

1. Allez sur [app.netlify.com](https://app.netlify.com)
2. Trouvez votre site (ID: `6b1db453-5ad9-4ea3-a025-ce9d134b442f`)
3. **Deploys** → **Trigger deploy** → **Deploy site**

## ⚠️ IMPORTANT : Variables d'Environnement

**Avant de déployer**, assurez-vous que toutes les variables d'environnement sont configurées sur Netlify :

### 🔐 Variables OBLIGATOIRES

1. **Supabase** (Authentification & Base de données)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **OpenAI** (Analyse IA)
   - `OPENAI_API_KEY`

3. **Nanonbanana** (Génération d'images)
   - `NANONBANANA_API_KEY` = `758a24cfaef8c64eed9164858b941ecc`

4. **Stripe** (Paiements)
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`

5. **URLs** (Configuration)
   - `NEXT_PUBLIC_APP_URL` = `https://votre-site.netlify.app`
   - `NEXT_PUBLIC_SITE_URL` = `https://votre-site.netlify.app`

### 📝 Comment Configurer

1. **Netlify** → Votre site → **Site settings**
2. **Build & deploy** → **Environment** → **Environment variables**
3. Cliquez sur **"Add variable"** pour chaque variable
4. **Scopes** : Sélectionnez **All scopes**

## 🔍 Vérification Post-Déploiement

Après le déploiement, vérifiez :

- [ ] ✅ Le build passe sans erreur
- [ ] ✅ Le site se charge correctement
- [ ] ✅ L'authentification fonctionne (connexion/inscription)
- [ ] ✅ Le dashboard s'affiche
- [ ] ✅ L'analyse de produit fonctionne
- [ ] ✅ La génération d'image fonctionne
- [ ] ✅ Les paiements fonctionnent (mode test Stripe)

## 📚 Documentation Complète

Pour plus de détails, consultez :
- **`DEPLOY_NETLIFY_COMPLETE.md`** : Guide complet avec toutes les étapes
- **`DEPLOY_QUICK.md`** : Guide rapide en 3 étapes

## 🆘 En Cas de Problème

1. **Build échoue** : Vérifiez les logs Netlify
2. **Variables manquantes** : Vérifiez que toutes les variables sont configurées
3. **Erreurs runtime** : Vérifiez les logs des fonctions serverless
4. **Authentification ne fonctionne pas** : Vérifiez les clés Supabase
5. **Analyse IA ne fonctionne pas** : Vérifiez `OPENAI_API_KEY`

## 🎉 Prêt à Déployer !

Votre code est prêt. Il suffit de :
1. Configurer les variables d'environnement sur Netlify
2. Déployer (via CLI, Git push, ou interface)

**Bonne chance ! 🚀**

