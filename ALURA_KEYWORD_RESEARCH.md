# Keyword Research Alura (ScraperAPI)

Les appels passent par **ScraperAPI** vers l’API Alura ou la page **keyword-finder-prod** (rendu JS), pour ne plus dépendre d’un Bearer qui expire toutes les heures.

## Variables

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `SCRAPER_API_KEY` | Oui | Clé ScraperAPI. |
| `ALURA_COOKIE` | Fortement recommandé | **En-tête Cookie complet** copié depuis Chrome → Réseau → une requête vers `alura-api` ou `app.alura.io` **pendant que tu es connecté**. |
| `ALURA_BEARER_TOKEN` | Non | Si l’API refuse sans Bearer, tu peux l’ajouter en plus du Cookie (même requête réseau). |

## Copier `ALURA_COOKIE`

1. Va sur [app.alura.io](https://app.alura.io), connecté.
2. Ouvre le Keyword Finder et lance une recherche.
3. F12 → **Réseau** → clique une requête **xhr** vers `alura-api-...a.run.app` ou `app.alura.io`.
4. **En-têtes** → **Cookie** : copie **toute** la valeur (une longue ligne `name=value; name2=value2; ...`).
5. Dans `.env.local` :

```env
ALURA_COOKIE=cf_clearance=...; __session=...; ...
```

Les cookies de session durent en général **plus longtemps** qu’un JWT Bearer seul. Quand ça refusera encore (401), recopie le Cookie après une nouvelle visite sur Alura.

## Comportement technique

1. ScraperAPI appelle l’API `v3/keywords/...` avec **premium** puis **ultra_premium** si besoin.
2. Si ça échoue ou que la réponse est vide : **page** `keyword-finder-prod?q=...` avec **render=true** et attente ~18–25 s, puis extraction du JSON `results` dans le HTML.

## Fichiers

- `src/lib/keyword-research/scrape-alura-keyword.ts`
