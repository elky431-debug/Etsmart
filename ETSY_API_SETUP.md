# 🔧 Configuration API Etsy - Guide de Setup

## 📋 Prérequis

1. **Compte développeur Etsy** : https://www.etsy.com/developers/
2. **Application Etsy créée** avec :
   - Keystring (API Key)
   - Secret
   - Redirect URI configuré

## 🔐 Variables d'Environnement

Ajoute ces variables dans ton `.env.local` (local) et dans **Netlify** (production) :

```bash
# Etsy API OAuth
ETSY_API_KEY=n1apzlzvs8qrtckzlr77761o
ETSY_API_SECRET=vyhfuc2z81
ETSY_REDIRECT_URI=https://ton-domaine.com/api/etsy/callback
# Pour local: http://localhost:3011/api/etsy/callback
```

⚠️ **IMPORTANT** : Les clés que tu as partagées sont maintenant **compromises**. Tu dois :
1. Aller sur https://www.etsy.com/developers/
2. **Révoquer** l'ancienne application
3. **Créer une nouvelle application**
4. **Générer de nouvelles clés**
5. Mettre à jour les variables d'environnement

## 🗄️ Base de Données Supabase

Exécute le script SQL pour créer la table `etsy_connections` :

```bash
# Dans Supabase Dashboard → SQL Editor
# Copie-colle le contenu de: supabase/create_etsy_connections_table.sql
```

Ou via la ligne de commande :
```bash
psql -h [ton-host] -U postgres -d postgres -f supabase/create_etsy_connections_table.sql
```

## 🚀 Routes API Créées

### 1. **OAuth Etsy**
- `GET /api/etsy/auth` → Initie le flux OAuth (redirige vers Etsy)
- `GET /api/etsy/callback` → Callback OAuth (reçoit le code, redirige vers le dashboard)
- `POST /api/etsy/finalize-connection` → Finalise la connexion avec l'user_id

### 2. **Récupération des Données**
- `GET /api/etsy/shop` → Infos du shop connecté
- `GET /api/etsy/listings` → Tous les listings du shop
  - Query param: `?include_images=true` pour inclure les images

### 3. **À Créer (Phase suivante)**
- `POST /api/etsy/analyze-listing` → Score un listing
- `GET /api/etsy/tag-metrics?tag=xxx` → Métriques d'un tag
- `POST /api/etsy/scrape-listing` → Scrape un listing concurrent

## 📱 Utilisation Frontend

### Exemple : Connecter un shop Etsy

```typescript
// 1. Rediriger vers OAuth
const response = await fetch('/api/etsy/auth', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
// La route redirige automatiquement vers Etsy

// 2. Après OAuth, le callback redirige vers:
// /dashboard/shop/analyze?etsy_oauth_success=true&tokens=xxx

// 3. Dans le frontend, récupérer les tokens et finaliser:
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('etsy_oauth_success') === 'true') {
  const encodedTokens = urlParams.get('tokens');
  const tokens = JSON.parse(atob(encodedTokens)); // base64 decode
  
  // Finaliser la connexion
  await fetch('/api/etsy/finalize-connection', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tokens)
  });
}
```

### Exemple : Récupérer les listings

```typescript
const response = await fetch('/api/etsy/listings?include_images=true', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});

const { listings } = await response.json();
// listings contient tous les listings avec leurs scores
```

## 🔍 Structure des Données

### EtsyShop (retourné par `/api/etsy/shop`)
```typescript
{
  shop_id: number;
  shop_name: string;
  title: string;
  url: string;
  listing_active_count: number;
  num_favorers: number;
  review_count: number;
  review_average: number | null;
  transaction_sold_count: number;
  // ... autres champs
}
```

### EtsyListing (retourné par `/api/etsy/listings`)
```typescript
{
  listing_id: number;
  title: string;
  description: string;
  price: number;
  currency_code: string;
  quantity: number;
  tags: string[];
  materials: string[];
  state: string;
  url: string;
  views: number;
  num_favorers: number;
  creation_tsz: number;
  last_modified_tsz: number;
  images?: Array<{
    id: number;
    url_570xN: string;
    url_fullxfull: string;
    rank: number;
  }>;
}
```

## ⚠️ Limitations & Notes

1. **API Etsy en attente d'approbation** : 
   - Si tes clés sont en "Pending Personal Approval", c'est normal que ça prenne du temps (Etsy est très strict)
   - **Tu peux quand même développer** : le système de scoring et le scraping fonctionnent sans l'API
   - Les routes `/api/etsy/scrape-listing` et `/api/etsy/analyze-listing` fonctionnent **sans** l'API Etsy
   - L'OAuth ne fonctionnera qu'une fois l'approbation obtenue

2. **Rate Limits Etsy** : L'API Etsy a des limites de requêtes. Implémenter un cache si nécessaire.

3. **Token Expiration** : Les tokens OAuth expirent. Il faudra implémenter un refresh token (pas encore fait).

4. **Scopes** : Actuellement on demande `listings_r`, `shops_r`, `profile_r` (lecture seule). C'est suffisant pour l'analyse.

5. **Erreurs OAuth** : Si le callback échoue, vérifier :
   - Que `ETSY_REDIRECT_URI` correspond exactement à celui configuré dans Etsy
   - Que les clés API sont correctes
   - Que l'application Etsy est **approuvée** (pas juste "Pending")

## 🐛 Debug

### Problème : "ETSY_API_KEY not configured"
→ Vérifier que les variables d'environnement sont bien définies dans Netlify

### Problème : "No Etsy shop connected"
→ L'utilisateur doit d'abord connecter son shop via OAuth

### Problème : "Token expired"
→ Implémenter le refresh token (à faire)

### Problème : "Failed to fetch shop from Etsy"
→ Vérifier que le token est valide et que l'API Etsy est accessible

## 📝 Prochaines Étapes

1. ✅ OAuth Etsy fonctionnel
2. ✅ Récupération des listings
3. ⏳ Système de scoring des listings
4. ⏳ Interface frontend Shop Analyzer
5. ⏳ Analyse des tags (demande/concurrence)
6. ⏳ Scraping amélioré pour concurrents
7. ⏳ Intégration avec l'extension

## 🔗 Documentation Etsy API

- Documentation officielle : https://developers.etsy.com/documentation/
- API v3 Reference : https://developers.etsy.com/documentation/reference

