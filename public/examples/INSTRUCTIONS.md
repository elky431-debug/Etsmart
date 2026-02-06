# Instructions pour ajouter l'image d'exemple

## Méthode rapide

1. **Téléchargez l'image** du screenshot AliExpress (tasse Etsmart) depuis le chat
2. **Renommez-la** en `screenshot-example.png`
3. **Placez-la** dans ce dossier : `public/examples/screenshot-example.png`

## Méthode avec script

Si vous avez l'image dans votre dossier Téléchargements ou ailleurs :

```bash
# Depuis le dossier Downloads
node scripts/add-example-image.js ~/Downloads/screenshot-example.png

# Ou avec le script shell
./scripts/add-example-image.sh ~/Downloads/screenshot-example.png
```

## Vérification

Une fois l'image ajoutée, elle apparaîtra automatiquement dans la section d'exemple sur la page d'import produit (`/app`).

L'image doit être :
- Format PNG
- Nom : `screenshot-example.png`
- Emplacement : `public/examples/screenshot-example.png`



































