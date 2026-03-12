# Configuration Tracktaco (Numéro de suivi)

L’onglet **Numéro de suivi** utilise l’API Tracktaco. Pour qu’il fonctionne, il faut configurer la clé API.

## 1. Récupérer ta clé API

- Va sur [app.tracktaco.com](https://app.tracktaco.com)
- Connecte-toi et ouvre l’onglet **API**
- Copie ta clé API (`x-api-key`)

## 2. En local (localhost)

Crée ou édite le fichier **`.env.local`** à la racine du projet :

```bash
TRACKTACO_API_KEY=ta_cle_api_ici
```

Redémarre le serveur de dev (`npm run dev` ou `npm run dev:3030`) après avoir modifié `.env.local`.

## 3. Sur Netlify

1. Ouvre ton site Netlify → **Site configuration** (ou **Site settings**)
2. **Environment variables** → **Add a variable** (ou **Add variable** / **Add new**)
3. Nom : `TRACKTACO_API_KEY`
4. Valeur : ta clé API Tracktaco
5. Sauvegarde puis **redéploie** le site (ou déclenche un nouveau deploy)

Une fois la variable définie, l’erreur « Clé API Tracktaco non configurée » disparaît et l’obtention de numéros de suivi fonctionne.
