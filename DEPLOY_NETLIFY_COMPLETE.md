# 🚀 Guide de Déploiement Complet sur Netlify

Ce guide vous permet de déployer **toute la version d'Etsmart** qui fonctionne sur localhost vers Netlify.

## ✅ Prérequis

1. ✅ Le build passe sans erreur (`npm run build`)
2. ✅ Un compte Netlify (gratuit ou payant)
3. ✅ Un compte GitHub/GitLab/Bitbucket (pour connecter le repository)

## 📋 Étape 1 : Préparer le Repository Git

### 1.1 Vérifier que tout est commité

```bash
cd /Users/yacineelfahim/Etsmart
git status
```

### 1.2 Commiter les changements si nécessaire

```bash
git add .
git commit -m "Préparation déploiement Netlify - Correction erreurs TypeScript"
git push
```

## 📋 Étape 2 : Créer/Connecter le Site sur Netlify

### Option A : Via l'interface Netlify (Recommandé)

1. Allez sur [app.netlify.com](https://app.netlify.com)
2. Cliquez sur **"Add new site"** → **"Import an existing project"**
3. Connectez votre repository (GitHub/GitLab/Bitbucket)
4. Sélectionnez le repository **Etsmart**
5. Netlify détectera automatiquement Next.js

### Option B : Via Netlify CLI

```bash
# Installer Netlify CLI (si pas déjà installé)
npm install -g netlify-cli

# Se connecter à Netlify
netlify login

# Initialiser le site
netlify init
```

## 📋 Étape 3 : Configurer les Variables d'Environnement

**⚠️ CRITIQUE :** Toutes ces variables doivent être configurées sur Netlify pour que l'application fonctionne.

### 3.1 Accéder aux Variables d'Environnement

1. Dans Netlify, allez dans votre site
2. **Site settings** → **Build & deploy** → **Environment** → **Environment variables**
3. Cliquez sur **"Add variable"** pour chaque variable

### 3.2 Variables Requises (À Configurer)

#### 🔐 Supabase (Authentification & Base de données)

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase (publique) | Supabase Dashboard → Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (privée) | Supabase Dashboard → Project Settings → API → `service_role` `secret` |

**⚠️ Important :** La clé `SUPABASE_SERVICE_ROLE_KEY` est **SECRÈTE**. Ne la partagez jamais publiquement.

#### 🤖 OpenAI (Analyse IA)

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `OPENAI_API_KEY` | Clé API OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

#### 🎨 Nanonbanana (Génération d'images)

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `NANONBANANA_API_KEY` | Clé API Nanonbanana | Dashboard Nanonbanana → API Keys |

**Valeur actuelle :** `758a24cfaef8c64eed9164858b941ecc`

#### 💳 Stripe (Paiements)

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe | Stripe Dashboard → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe | Stripe Dashboard → Developers → Webhooks → Signing secret |

#### 🌐 URLs de l'Application

| Variable | Description | Valeur recommandée |
|----------|-------------|---------------------|
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app | `https://votre-site.netlify.app` ou votre domaine personnalisé |
| `NEXT_PUBLIC_SITE_URL` | URL du site (pour Stripe) | `https://votre-site.netlify.app` ou votre domaine personnalisé |

#### 🔍 Scraping (Optionnel - pour le parsing de produits)

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `SCRAPER_API_KEY` | Clé API ScraperAPI (optionnel) | [scraperapi.com](https://www.scraperapi.com) |
| `SCRAPINGBEE_API_KEY` | Clé API ScrapingBee (optionnel) | [scrapingbee.com](https://www.scrapingbee.com) |
| `ZENROWS_API_KEY` | Clé API ZenRows (optionnel) | [zenrows.com](https://www.zenrows.com) |
| `PROXY_LIST` | Liste de proxies (optionnel) | Format: `proxy1:port,proxy2:port` |

#### ⏰ Cron Jobs (Optionnel)

| Variable | Description | Valeur recommandée |
|----------|-------------|---------------------|
| `CRON_SECRET` | Secret pour sécuriser les cron jobs | Générer une chaîne aléatoire sécurisée |

### 3.3 Configuration des Scopes

Pour chaque variable, sélectionnez :
- **All scopes** (recommandé) : Disponible partout
- Ou spécifiez selon vos besoins :
  - **Build** : Disponible uniquement pendant le build
  - **Runtime** : Disponible uniquement à l'exécution

## 📋 Étape 4 : Configurer le Webhook Stripe

### 4.1 Créer le Webhook sur Stripe

1. Allez sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Developers** → **Webhooks** → **Add endpoint**
3. **Endpoint URL** : `https://votre-site.netlify.app/api/webhooks/stripe`
4. **Events to send** : Sélectionnez tous les événements liés aux abonnements :
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
5. Copiez le **Signing secret** et ajoutez-le comme `STRIPE_WEBHOOK_SECRET` sur Netlify

## 📋 Étape 5 : Configurer le Callback Nanonbanana

### 5.1 URL de Callback

L'URL de callback est automatiquement configurée dans le code :
```
https://votre-site.netlify.app/api/nanonbanana-callback
```

Assurez-vous que cette URL est accessible publiquement (pas de protection par mot de passe).

## 📋 Étape 6 : Configurer le Build

### 6.1 Vérifier netlify.toml

Le fichier `netlify.toml` est déjà configuré :

```toml
[build]
  command = "npm run build"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### 6.2 Paramètres de Build sur Netlify

1. **Site settings** → **Build & deploy** → **Build settings**
2. Vérifiez que :
   - **Build command** : `npm run build`
   - **Publish directory** : `.next` (géré automatiquement par le plugin Next.js)

## 📋 Étape 7 : Déployer

### Option A : Déploiement Automatique (Recommandé)

Si vous avez connecté votre repository Git :
1. Netlify déploiera automatiquement à chaque `git push`
2. Allez dans **Deploys** pour voir le statut

### Option B : Déploiement Manuel

1. **Deploys** → **Trigger deploy** → **Deploy site**
2. Attendez que le build se termine (2-5 minutes)

## 📋 Étape 8 : Vérifier le Déploiement

### 8.1 Vérifications de Base

1. ✅ Le build passe sans erreur
2. ✅ Le site se charge correctement
3. ✅ L'authentification fonctionne (connexion/inscription)
4. ✅ Le dashboard s'affiche

### 8.2 Vérifications Fonctionnelles

1. ✅ **Analyse de produit** : Testez avec un lien AliExpress/Alibaba
2. ✅ **Génération d'image** : Testez la génération d'image avec Nanonbanana
3. ✅ **Paiements** : Testez le processus d'abonnement (mode test Stripe)
4. ✅ **Webhooks** : Vérifiez que les webhooks Stripe fonctionnent

### 8.3 Vérifier les Logs

1. **Deploys** → Sélectionnez un déploiement → **Functions logs**
2. Vérifiez qu'il n'y a pas d'erreurs liées aux variables d'environnement

## 🔧 Résolution de Problèmes

### ❌ Build échoue

**Erreur :** Variables d'environnement manquantes
- **Solution :** Vérifiez que toutes les variables requises sont configurées sur Netlify

**Erreur :** TypeScript errors
- **Solution :** Vérifiez que `npm run build` passe en local avant de déployer

### ❌ Application ne fonctionne pas après déploiement

**Problème :** Authentification ne fonctionne pas
- **Solution :** Vérifiez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Problème :** Analyse IA ne fonctionne pas
- **Solution :** Vérifiez `OPENAI_API_KEY`

**Problème :** Génération d'image ne fonctionne pas
- **Solution :** Vérifiez `NANONBANANA_API_KEY` et l'URL de callback

**Problème :** Paiements ne fonctionnent pas
- **Solution :** Vérifiez `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`

### ❌ Timeout sur les API Routes

**Problème :** Les routes API dépassent 50 secondes
- **Solution :** Netlify limite à 50s. Le code utilise déjà des timeouts de 45s pour éviter cela.

## 📝 Checklist de Déploiement

- [ ] Build passe en local (`npm run build`)
- [ ] Repository Git à jour et poussé
- [ ] Site créé sur Netlify
- [ ] Repository connecté à Netlify
- [ ] Variables d'environnement configurées :
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `NANONBANANA_API_KEY`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `NEXT_PUBLIC_APP_URL`
  - [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] Webhook Stripe configuré
- [ ] Build Netlify réussi
- [ ] Site accessible et fonctionnel
- [ ] Tests fonctionnels passés

## 🎉 Félicitations !

Votre application Etsmart est maintenant déployée sur Netlify ! 🚀

## 📞 Support

En cas de problème :
1. Vérifiez les logs Netlify
2. Vérifiez les logs des fonctions serverless
3. Vérifiez que toutes les variables d'environnement sont correctes
4. Consultez la documentation Netlify : [docs.netlify.com](https://docs.netlify.com)

