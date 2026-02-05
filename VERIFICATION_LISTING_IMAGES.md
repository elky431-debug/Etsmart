# ✅ Vérification : Crédits pour Listing et Images

## Système actuel

### Listing seul (Description Etsy)
- **Coût** : 0.25 crédit
- **API** : `/api/generate-etsy-description`
- **Vérification quota** : `quotaInfo.remaining < 0.25`
- **Décrémentation** : `incrementAnalysisCount(user.id, 0.25)`

### Image seule
- **Coût** : 0.25 crédit
- **API** : `/api/generate-images`
- **Vérification quota** : `quotaInfo.remaining < 0.25`
- **Décrémentation** : `incrementAnalysisCount(user.id, 0.25)`

### Listing + Image
- **Coût total** : 0.5 crédit (0.25 + 0.25)
- Chaque opération décrémente séparément
- Si vous générez le listing puis l'image : 0.25 + 0.25 = 0.5 crédit ✅

## ✅ Vérifications effectuées

### 1. API `/api/generate-etsy-description`
- ✅ Vérifie que `remaining >= 0.25` avant génération
- ✅ Décrémente `0.25` crédit après génération réussie
- ✅ Logs détaillés pour le débogage

### 2. API `/api/generate-images`
- ✅ Vérifie que `remaining >= 0.25` avant génération
- ✅ Décrémente `0.25` crédit après génération réussie
- ✅ Logs détaillés pour le débogage

### 3. Rafraîchissement automatique
- ✅ `DashboardListingImages` rafraîchit après génération de listing
- ✅ `ImageGenerator` rafraîchit après génération d'image
- ✅ Délai de 1 seconde pour laisser la DB se synchroniser
- ✅ Événement `subscription-refresh` pour notifier le dashboard

## 📊 Exemple de flux

**Scénario 1 : Listing seul**
1. Utilisateur a 8 crédits
2. Génère le listing → Décrémente 0.25
3. Résultat : 7.75 crédits ✅

**Scénario 2 : Image seule**
1. Utilisateur a 8 crédits
2. Génère l'image → Décrémente 0.25
3. Résultat : 7.75 crédits ✅

**Scénario 3 : Listing + Image**
1. Utilisateur a 8 crédits
2. Génère le listing → Décrémente 0.25 → 7.75 crédits
3. Génère l'image → Décrémente 0.25 → 7.5 crédits
4. **Total consommé : 0.5 crédit** ✅

## 🎯 Conclusion

Le système fonctionne **exactement** comme demandé :
- ✅ Listing seul : 0.25 crédit
- ✅ Image seule : 0.25 crédit
- ✅ Listing + Image : 0.5 crédit (0.25 + 0.25)

Aucune modification nécessaire, tout est déjà en place !

