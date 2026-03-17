# 🎯 Plan d'Implémentation - Shop Analyzer Style RankHero

## 📋 Vue d'ensemble

Créer un **Shop Analyzer** complet qui permet :
1. **Analyser le shop de l'utilisateur** (via API Etsy OAuth - données réelles)
2. **Analyser les shops concurrents** (via scraping amélioré)
3. **Scorer chaque listing** (titre, tags, images, description, etc.)
4. **Analyser les tags** (demande, concurrence, opportunité)
5. **Intégrer avec l'extension** (remplacer le scraping instable par des appels API backend)

---

## 🏗️ Architecture Technique

### 1. **OAuth Etsy (Connexion du shop utilisateur)**

#### Routes API à créer :
- `GET /api/etsy/auth` → Redirige vers Etsy OAuth
- `GET /api/etsy/callback` → Reçoit le code, échange contre access_token, stocke dans Supabase
- `GET /api/etsy/disconnect` → Déconnecte le shop

#### Table Supabase à créer :
```sql
CREATE TABLE etsy_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL,
  shop_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);
```

#### Variables d'environnement nécessaires :
- `ETSY_API_KEY` (keystring)
- `ETSY_API_SECRET` (secret)
- `ETSY_REDIRECT_URI` (ex: `https://ton-domaine.com/api/etsy/callback`)

---

### 2. **Récupération des Listings (API Etsy)**

#### Routes API :
- `GET /api/etsy/shop` → Récupère les infos du shop connecté
- `GET /api/etsy/listings` → Récupère tous les listings du shop (avec pagination)
- `GET /api/etsy/listing/:listingId` → Détails d'un listing spécifique

#### Données récupérées via API Etsy :
- Shop : nom, localisation, nombre de ventes, date de création, reviews
- Listings : titre, description, tags, prix, quantité, images, matériaux, statut, date de création, date de mise à jour
- Stats (si disponibles) : vues, favoris, ventes

---

### 3. **Système de Scoring des Listings**

#### Route API :
- `POST /api/etsy/analyze-listing` → Analyse et score un listing

#### Critères de scoring (0-100 pour chaque) :

**TITLE (100 points)**
- Longueur optimale (100-140 caractères) : 30 points
- Mots-clés SEO pertinents : 25 points
- Structure claire (séparateurs, cohérence) : 20 points
- Évite le keyword stuffing : 15 points
- Mots-clés en début de titre : 10 points

**TAGS (100 points)**
- Nombre de tags (13 tags max) : 20 points
- Longueur des tags (max 20 caractères) : 15 points
- Pertinence des tags vs produit : 25 points
- Diversité (pas de doublons) : 15 points
- Opportunité SEO (demande vs concurrence) : 25 points

**IMAGES (100 points)**
- Nombre d'images (5-10 idéal) : 20 points
- Qualité perçue (via IA si possible) : 30 points
- Cohérence visuelle : 20 points
- Première image accrocheuse : 15 points
- Images montrant différents angles : 15 points

**VIDEO (100 points)**
- Présence d'une vidéo : 50 points
- Longueur optimale (30-60s) : 25 points
- Qualité du contenu : 25 points

**MATERIALS (100 points)**
- Matériaux renseignés : 50 points
- Nombre de matériaux (2-4 idéal) : 25 points
- Pertinence : 25 points

**DESCRIPTION (100 points)**
- Longueur (300-500 mots) : 20 points
- Structure (sections claires) : 20 points
- Mots-clés SEO : 15 points
- Bénéfices client : 20 points
- Call-to-action : 10 points
- Emojis stratégiques : 15 points

#### Score global (Grade A/B/C/D/F) :
- A : 90-100
- B : 80-89
- C : 70-79
- D : 60-69
- F : <60

---

### 4. **Analyse des Tags (Demande & Concurrence)**

#### Route API :
- `GET /api/etsy/tag-metrics?tag=xxx` → Retourne demande, concurrence, opportunité

#### Logique :
1. **Concurrence** : Scraper `https://www.etsy.com/search?q=tag` → compter les résultats
2. **Demande estimée** :
   - Basée sur la popularité des listings qui rankent sur ce tag
   - Fréquence d'apparition dans les tops résultats
   - Historique (si on scrape régulièrement)
3. **Score d'opportunité** : `(demande / concurrence) * 100` (normalisé)

#### Table Supabase (cache) :
```sql
CREATE TABLE etsy_tag_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag TEXT NOT NULL UNIQUE,
  competition_count INTEGER,
  estimated_demand INTEGER,
  opportunity_score INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 5. **Scraping Amélioré pour Concurrents**

#### Route API :
- `POST /api/etsy/scrape-listing` → Scrape une page listing Etsy (pour concurrents)
- `POST /api/etsy/scrape-shop` → Scrape une page shop Etsy (pour concurrents)

#### Données extraites :
- Titre, description, tags (dans le HTML/meta)
- Prix, quantité, matériaux
- Images (URLs)
- Stats publiques : ventes, reviews, favoris (si visibles)
- Shop : nom, localisation, nombre de ventes total

#### Améliorations vs extension actuelle :
- Côté backend (plus stable)
- Parser robuste avec fallbacks multiples
- Cache des résultats (éviter de re-scraper)
- Rate limiting (éviter les bans)

---

### 6. **Interface Frontend (Dashboard)**

#### Page : `/dashboard/shop/analyze`

#### Composants à créer :
- `ShopAnalyzerClient.tsx` → Composant principal
- `ShopConnectionCard.tsx` → Card pour connecter/déconnecter le shop
- `ListingCard.tsx` → Card d'un listing avec grade + scores
- `ListingScoreBreakdown.tsx` → Détails des scores (titre, tags, etc.)
- `TagAnalysisModal.tsx` → Modal pour analyser un tag spécifique
- `ShopStatsOverview.tsx` → Vue d'ensemble du shop (moyennes, top listings, etc.)

#### Fonctionnalités UI :
- Liste des listings avec tri (grade, score, date, prix)
- Filtres (grade, tags, matériaux)
- Vue détaillée d'un listing (scores, recommandations)
- Export des analyses (CSV/PDF)

---

### 7. **Intégration Extension**

#### Modifications dans `content-script.js` :

**Avant (scraping direct)** :
```js
// Scrape directement dans le navigateur
const listingData = extractListingData();
```

**Après (appel backend)** :
```js
// Envoie l'URL au backend
const response = await fetch('https://ton-domaine.com/api/etsy/scrape-listing', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ url: window.location.href })
});
const listingData = await response.json();
```

#### Avantages :
- Plus stable (backend gère les changements de structure Etsy)
- Moins de code dans l'extension
- Cache centralisé
- Analytics centralisés

---

## 📊 Flux Utilisateur

### Scénario 1 : Analyser son propre shop
1. User va sur `/dashboard/shop/analyze`
2. Clique sur "Connecter mon shop Etsy"
3. Redirection OAuth Etsy → accepte les permissions
4. Retour sur le dashboard → import automatique des listings
5. Affichage de tous les listings avec scores + grades
6. User peut cliquer sur un listing pour voir le détail

### Scénario 2 : Analyser un concurrent (via extension)
1. User navigue sur Etsy (page listing ou shop)
2. Extension détecte → envoie l'URL au backend
3. Backend scrape → analyse → score
4. Extension affiche un popup avec le score + recommandations

### Scénario 3 : Analyser un concurrent (via dashboard)
1. User va sur `/dashboard/shop/analyze`
2. Section "Analyser un shop concurrent"
3. Entre l'URL du shop ou d'un listing
4. Backend scrape → analyse → affiche les résultats

---

## 🔧 Implémentation - Ordre de Priorité

### Phase 1 : Fondations (OAuth + API Etsy)
- [ ] Créer table `etsy_connections` dans Supabase
- [ ] Route `GET /api/etsy/auth`
- [ ] Route `GET /api/etsy/callback`
- [ ] Route `GET /api/etsy/shop`
- [ ] Route `GET /api/etsy/listings`
- [ ] Tester la connexion OAuth

### Phase 2 : Scoring des Listings
- [ ] Créer lib `lib/etsy/listing-scorer.ts`
- [ ] Implémenter scoring TITLE
- [ ] Implémenter scoring TAGS
- [ ] Implémenter scoring IMAGES
- [ ] Implémenter scoring DESCRIPTION
- [ ] Implémenter scoring MATERIALS
- [ ] Implémenter scoring VIDEO
- [ ] Route `POST /api/etsy/analyze-listing`

### Phase 3 : Analyse des Tags
- [ ] Créer table `etsy_tag_metrics`
- [ ] Route `GET /api/etsy/tag-metrics`
- [ ] Fonction de scraping de recherche Etsy
- [ ] Calcul de demande/concurrence
- [ ] Cache des métriques

### Phase 4 : Scraping Amélioré
- [ ] Route `POST /api/etsy/scrape-listing`
- [ ] Route `POST /api/etsy/scrape-shop`
- [ ] Parser robuste avec fallbacks
- [ ] Cache des résultats scrapés

### Phase 5 : Interface Frontend
- [ ] Page `/dashboard/shop/analyze`
- [ ] Composant `ShopConnectionCard`
- [ ] Composant `ListingCard` (avec grade + scores)
- [ ] Composant `ListingScoreBreakdown`
- [ ] Composant `ShopStatsOverview`
- [ ] Intégration avec les routes API

### Phase 6 : Extension
- [ ] Modifier `content-script.js` pour appeler le backend
- [ ] Gérer l'authentification (token)
- [ ] Afficher les résultats dans un popup
- [ ] Tester sur différentes pages Etsy

---

## 🔐 Sécurité

- **OAuth tokens** : Stockés chiffrés dans Supabase (ou utiliser Vault)
- **Rate limiting** : Limiter les appels API Etsy (éviter les bans)
- **Scraping** : User-Agent rotation, délais entre requêtes
- **Authentification** : Toutes les routes API nécessitent un token valide

---

## 📝 Notes Techniques

### API Etsy v3
- Base URL : `https://api.etsy.com/v3`
- Documentation : https://developers.etsy.com/documentation/
- Scopes nécessaires : `listings_r`, `shops_r` (lecture seule)

### Limitations
- Etsy limite les appels API (rate limits)
- Scraping peut être bloqué (User-Agent, IP)
- Certaines données ne sont pas publiques (stats détaillées des concurrents)

### Alternatives si scraping bloqué
- Utiliser des services tiers (proxies, APIs de scraping)
- Focus sur l'analyse du shop de l'utilisateur (données réelles via API)
- Estimations basées sur données publiques disponibles

---

## ✅ Checklist Finale

- [ ] OAuth Etsy fonctionnel
- [ ] Récupération des listings via API
- [ ] Scoring des listings opérationnel
- [ ] Analyse des tags fonctionnelle
- [ ] Scraping amélioré pour concurrents
- [ ] Interface dashboard complète
- [ ] Extension intégrée
- [ ] Tests end-to-end
- [ ] Documentation utilisateur

---

## 🚀 Prochaines Étapes

1. **Créer les routes OAuth Etsy** (Phase 1)
2. **Tester la connexion avec un vrai shop**
3. **Implémenter le scoring de base** (Phase 2)
4. **Créer l'interface frontend** (Phase 5)
5. **Intégrer avec l'extension** (Phase 6)

