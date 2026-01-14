# Etsmart - Copilote Intelligent pour Etsy 🚀

Etsmart est un SaaS web B2B qui aide les utilisateurs à lancer une boutique rentable sur Etsy en analysant, **AVANT le lancement**, si des produits fournisseurs (AliExpress / Alibaba) ont un réel potentiel.

![Etsmart](https://img.shields.io/badge/Version-1.0.0-violet)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan)

## 🎯 Objectif

Etsmart permet de savoir **AVANT de lancer** si un produit fournisseur peut réussir sur Etsy :
- Combien il peut vendre en 3 mois
- En combien de temps il peut faire sa première vente
- À quel prix le vendre
- Comment le positionner

## ✨ Fonctionnalités

### MVP V1 (Implémenté)
- ✅ Choix de la niche
- ✅ Ajout de liens produits (AliExpress / Alibaba)
- ✅ Détection des concurrents Etsy avec liens
- ✅ Estimation des revenus des concurrents
- ✅ Simulation de lancement (temps 1ère vente + ventes 3 mois)
- ✅ Verdict final (🟢 Lancer / 🟡 Tester / 🔴 Éviter)
- ✅ Dashboard global boutique

### V2 (Prévu)
- 🔲 Prédiction de saturation avancée
- 🔲 Angles marketing détaillés
- 🔲 Pricing avancé avec A/B testing
- 🔲 Alertes et notifications

## 🛠️ Stack Technique

- **Frontend**: Next.js 15 (App Router) + React 19
- **Styling**: Tailwind CSS 4 + CSS Variables
- **Animations**: Framer Motion
- **State Management**: Zustand (avec persistance)
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Language**: TypeScript 5

## 🚀 Installation

```bash
# Cloner le projet
git clone https://github.com/your-username/etsmart.git
cd etsmart

# Installer les dépendances
npm install

# Configurer Supabase (voir section ci-dessous)
# Créer un fichier .env.local avec vos clés Supabase

# Lancer en développement
npm run dev

# Ouvrir http://localhost:3000
```

## 🗄️ Configuration Supabase

1. **Créer un projet Supabase**
   - Allez sur [supabase.com](https://supabase.com)
   - Créez un nouveau projet
   - Notez votre Project URL et vos clés API

2. **Configurer les variables d'environnement**
   - Créez un fichier `.env.local` à la racine du projet
   - Ajoutez les variables suivantes :
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (optionnel)
   ```

3. **Créer le schéma de base de données**
   - Dans Supabase, allez dans **SQL Editor**
   - Exécutez le contenu du fichier `supabase/schema.sql`
   - Vérifiez que toutes les tables sont créées

4. **Voir le guide complet**
   - Consultez `supabase/README.md` pour plus de détails

## 📁 Structure du Projet

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/          # API d'analyse produit
│   │   ├── competitors/      # API recherche concurrents
│   │   └── parse-product/    # API parsing URL fournisseur
│   ├── globals.css           # Styles globaux
│   ├── layout.tsx            # Layout principal
│   └── page.tsx              # Page d'accueil
├── components/
│   ├── analysis/             # Composants d'analyse
│   │   ├── CompetitorCard.tsx
│   │   ├── LaunchSimulation.tsx
│   │   ├── MarketingAngles.tsx
│   │   ├── PricingCard.tsx
│   │   ├── SaturationChart.tsx
│   │   └── VerdictCard.tsx
│   ├── dashboard/
│   │   └── GlobalDashboard.tsx
│   ├── layout/
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   └── Stepper.tsx
│   ├── steps/
│   │   ├── AnalysisStep.tsx
│   │   ├── NicheSelection.tsx
│   │   ├── ProductImport.tsx
│   │   └── ResultsStep.tsx
│   └── ui/                   # Composants UI réutilisables
│       ├── Badge.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Progress.tsx
│       └── Tooltip.tsx
├── lib/
│   ├── mockAnalysis.ts       # Générateur de données mock
│   ├── niches.ts             # Configuration des niches
│   └── utils.ts              # Utilitaires
├── store/
│   └── useStore.ts           # Store Zustand
└── types/
    └── index.ts              # Types TypeScript
```

## 📊 Parcours Utilisateur

1. **Étape 1 - Définition de la niche**
   - Sélection parmi les niches prédéfinies ou personnalisée
   - La niche sert de contexte pour toutes les analyses

2. **Étape 2 - Ajout des produits**
   - Coller les URLs AliExpress ou Alibaba
   - Extraction automatique des informations produit

3. **Étape 3 - Analyse**
   - Détection des concurrents Etsy
   - Estimation des revenus
   - Analyse de saturation
   - Simulation de lancement
   - Recommandation de prix

4. **Étape 4 - Résultats**
   - Verdict par produit (Lancer/Tester/Éviter)
   - Dashboard global boutique
   - Stratégie recommandée

## 🎨 Design

- **Theme**: Dark mode avec accents violet/fuchsia
- **UI/UX**: Focus sur la décision, pas sur les données brutes
- **Animations**: Transitions fluides avec Framer Motion
- **Responsive**: Optimisé mobile et desktop

## ⚠️ Avertissement

> Toutes les données affichées sont des **estimations** basées sur des données publiques.
> Aucune promesse de gains n'est garantie.
> Toujours afficher les raisons derrière chaque chiffre.

## 🔮 Roadmap

### Phase 1 - MVP ✅
- Interface utilisateur complète
- Analyse simulée (mock data)
- Verdict et recommandations

### Phase 2 - Backend
- Scraping réel des produits fournisseurs
- Recherche et analyse des concurrents Etsy
- Base de données PostgreSQL

### Phase 3 - IA & ML
- Similarité d'images pour matching produits
- NLP pour analyse des avis et titres
- Modèles prédictifs de ventes

### Phase 4 - Production
- Authentification utilisateurs
- Plans d'abonnement
- API publique
- Alertes temps réel

## 📄 License

MIT License - voir [LICENSE](LICENSE)

---

**Etsmart** - Assistant décisionnel pour lancer une boutique Etsy rentable 💜
